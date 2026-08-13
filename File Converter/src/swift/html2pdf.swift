// html2pdf — renders a local HTML file to a paginated A4 PDF using WKWebView,
// the same engine Safari uses. Avoids pulling in a headless Chromium just to
// print a page.
//
// Usage: html2pdf <input.html> <output.pdf>
//
// Two approaches were tried and rejected before this one:
//
//   * WKWebView.createPDF on its own captures the whole scroll height as a
//     single enormous page — no pagination at all.
//   * NSPrintOperation paginates correctly but never terminates in a headless
//     process; it emitted over a million pages before being killed.
//
// So pagination is done in the DOM instead: measure where each block lands,
// push any block that would straddle a page boundary onto the next page, then
// capture one rect per page and compose the slices onto A4 with margins. That
// is deterministic and needs no third-party dependency.
//
// Exit codes:
//   0  success
//   2  bad arguments
//   4  input missing
//   6  load, render or write failed
//   7  timed out

import Foundation
import WebKit
import AppKit
import CoreGraphics

let TIMEOUT_SECONDS = 120.0

// A4 at 72dpi, which is also 1 CSS pixel per point in WKWebView.
let PAGE_WIDTH: CGFloat = 595.28
let PAGE_HEIGHT: CGFloat = 841.89
let PAGE_MARGIN: CGFloat = 56.7  // 2cm, matching the docx renderer.

let CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
let CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2

/// Guards against a runaway document producing an unusable file.
let MAX_PAGES = 2000

func fail(_ code: Int32, _ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(code)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
  fail(2, "usage: html2pdf <input.html> <output.pdf>")
}

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])

guard FileManager.default.fileExists(atPath: inputURL.path) else {
  fail(4, "input not found: \(inputURL.lastPathComponent)")
}

// WebKit needs an application context, but this is a CLI with no UI.
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

/**
 Measures the laid-out document and inserts spacers so that no top-level block
 straddles a page boundary, then reports how many pages that comes to.

 Anything taller than a whole page is left alone — it has to be split somewhere.
 */
func paginationScript(contentHeight: CGFloat) -> String {
  return """
  (function () {
    var pageHeight = \(contentHeight);
    document.body.style.margin = '0';

    var blocks = Array.prototype.slice.call(document.body.children);
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (el.hasAttribute('data-page-spacer')) continue;

      var rect = el.getBoundingClientRect();
      var top = rect.top + window.scrollY;
      var height = rect.height;
      if (height <= 0 || height > pageHeight) continue;

      var startPage = Math.floor(top / pageHeight);
      var endPage = Math.floor((top + height - 0.5) / pageHeight);

      // A heading that fits at the foot of a page is not straddling anything,
      // but leaving it there orphans it from the text it introduces. Push it
      // over if there is no room for a couple of lines underneath.
      var isHeading = /^H[1-6]$/.test(el.tagName);
      var roomBelow = (startPage + 1) * pageHeight - (top + height);
      if (endPage === startPage && !(isHeading && roomBelow < 48)) continue;
      if (endPage !== startPage && isHeading) endPage = startPage;

      // Whatever gets pushed takes its heading with it, otherwise the heading
      // is left stranded at the foot of the previous page.
      var anchor = el;
      var previous = anchor.previousElementSibling;
      while (previous && previous.hasAttribute('data-page-spacer')) {
        previous = previous.previousElementSibling;
      }
      if (previous && /^H[1-6]$/.test(previous.tagName)) {
        anchor = previous;
        top = previous.getBoundingClientRect().top + window.scrollY;
        startPage = Math.floor(top / pageHeight);
      }

      var spacer = document.createElement('div');
      spacer.setAttribute('data-page-spacer', '');
      spacer.style.height = ((startPage + 1) * pageHeight - top) + 'px';
      spacer.style.margin = '0';
      anchor.parentNode.insertBefore(spacer, anchor);
    }

    var total = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    return Math.max(1, Math.ceil(total / pageHeight));
  })();
  """
}

/// Composes the per-page captures onto A4 pages, inset by the margins.
func writePdf(slices: [Data], to url: URL) throws {
  guard let consumer = CGDataConsumer(url: url as CFURL) else {
    throw NSError(domain: "html2pdf", code: 1,
                  userInfo: [NSLocalizedDescriptionKey: "cannot write to \(url.path)"])
  }
  var mediaBox = CGRect(x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT)
  guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
    throw NSError(domain: "html2pdf", code: 2,
                  userInfo: [NSLocalizedDescriptionKey: "cannot create pdf context"])
  }

  for slice in slices {
    guard let provider = CGDataProvider(data: slice as CFData),
          let document = CGPDFDocument(provider),
          let page = document.page(at: 1) else { continue }

    context.beginPDFPage(nil)
    context.saveGState()
    // PDF origin is bottom-left, so the top margin is applied from the bottom.
    context.translateBy(x: PAGE_MARGIN, y: PAGE_MARGIN)
    context.drawPDFPage(page)
    context.restoreGState()
    context.endPDFPage()
  }

  context.closePDF()
}

final class Renderer: NSObject, WKNavigationDelegate {
  private let webView: WKWebView
  private let outputURL: URL

  init(outputURL: URL) {
    self.webView = WKWebView(
      frame: NSRect(x: 0, y: 0, width: CONTENT_WIDTH, height: CONTENT_HEIGHT),
      configuration: WKWebViewConfiguration())
    self.outputURL = outputURL
    super.init()
    self.webView.navigationDelegate = self
  }

  func render(_ inputURL: URL) {
    webView.loadFileURL(inputURL, allowingReadAccessTo: inputURL.deletingLastPathComponent())
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    // Give web fonts and local images a moment to settle; measuring before
    // they load gives the wrong heights and therefore the wrong breaks.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
      webView.evaluateJavaScript(paginationScript(contentHeight: CONTENT_HEIGHT)) { value, error in
        if let error = error {
          fail(6, "pagination failed: \(error.localizedDescription)")
        }
        let pageCount = min(max((value as? Int) ?? 1, 1), MAX_PAGES)

        // The view has to be tall enough to have laid the whole document out
        // before any region of it can be captured.
        webView.frame = NSRect(
          x: 0, y: 0,
          width: CONTENT_WIDTH,
          height: CONTENT_HEIGHT * CGFloat(pageCount))

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
          self.capture(webView: webView, pageCount: pageCount)
        }
      }
    }
  }

  /// Captures one rect per page, in order, then writes the composed document.
  private func capture(webView: WKWebView, pageCount: Int) {
    var slices: [Data] = []

    func next(_ index: Int) {
      if index >= pageCount {
        do {
          try writePdf(slices: slices, to: self.outputURL)
          exit(0)
        } catch {
          fail(6, "could not write pdf: \(error.localizedDescription)")
        }
      }

      let configuration = WKPDFConfiguration()
      configuration.rect = CGRect(
        x: 0,
        y: CGFloat(index) * CONTENT_HEIGHT,
        width: CONTENT_WIDTH,
        height: CONTENT_HEIGHT)

      webView.createPDF(configuration: configuration) { result in
        switch result {
        case .success(let data):
          slices.append(data)
          next(index + 1)
        case .failure(let error):
          fail(6, "page \(index + 1) failed: \(error.localizedDescription)")
        }
      }
    }

    next(0)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    fail(6, "load failed: \(error.localizedDescription)")
  }

  func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    fail(6, "load failed: \(error.localizedDescription)")
  }
}

let renderer = Renderer(outputURL: outputURL)
renderer.render(inputURL)

// A page that never finishes loading would otherwise hang the batch forever.
DispatchQueue.main.asyncAfter(deadline: .now() + TIMEOUT_SECONDS) {
  fail(7, "timed out after \(Int(TIMEOUT_SECONDS))s")
}

RunLoop.main.run()
