// bgremove — strips the background from an image using the macOS Vision
// framework, the same engine behind Preview's "Remove Background".
//
// Usage: bgremove <input> <output.png> [all|largest]
//
// Exit codes are distinct per failure class so the Node side can tell a
// genuine error apart from "this photo simply has no subject":
//   0  success
//   2  bad arguments
//   3  macOS too old
//   4  input could not be decoded
//   5  no foreground subject detected  (Node treats this as a skip, not a failure)
//   6  Vision or encoding failed

import Foundation
import Vision
import CoreImage
import CoreGraphics
import ImageIO

/// Writes a one-line reason to stderr and exits. The Node side surfaces only
/// the first stderr line, so keep it to one line.
func fail(_ code: Int32, _ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(code)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
  fail(2, "usage: bgremove <input> <output.png> [all|largest]")
}

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])
let subjectMode = args.count > 3 ? args[3] : "all"

// The foreground-instance mask request landed in macOS 14. Gate explicitly so
// older systems get a readable message instead of a dyld symbol crash.
guard #available(macOS 14.0, *) else {
  fail(3, "requires macOS 14 or newer")
}

guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let decoded = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fail(4, "could not decode \(inputURL.lastPathComponent)")
}

let ciContext = CIContext(options: nil)

// Phone cameras store the sensor buffer unrotated plus an EXIF orientation tag.
// CGImageSourceCreateImageAtIndex hands back that raw buffer, so baking the
// rotation in here is what stops portrait photos coming out sideways.
var upright = CIImage(cgImage: decoded)
if let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
   let rawOrientation = properties[kCGImagePropertyOrientation] as? UInt32,
   let orientation = CGImagePropertyOrientation(rawValue: rawOrientation) {
  upright = upright.oriented(orientation)
}

guard let cgImage = ciContext.createCGImage(upright, from: upright.extent) else {
  fail(4, "could not normalise orientation of \(inputURL.lastPathComponent)")
}

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()

do {
  try handler.perform([request])
} catch {
  fail(6, "vision request failed: \(error.localizedDescription)")
}

guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
  fail(5, "no foreground subject detected")
}

/// Counts opaque pixels in a single-channel mask buffer. Used to rank instances
/// by real area, since instance indices carry no ordering information.
@available(macOS 14.0, *)
func maskArea(_ buffer: CVPixelBuffer) -> Int {
  CVPixelBufferLockBaseAddress(buffer, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }

  guard let base = CVPixelBufferGetBaseAddress(buffer) else { return 0 }
  let width = CVPixelBufferGetWidth(buffer)
  let height = CVPixelBufferGetHeight(buffer)
  let stride = CVPixelBufferGetBytesPerRow(buffer)
  let format = CVPixelBufferGetPixelFormatType(buffer)

  var count = 0
  if format == kCVPixelFormatType_OneComponent32Float {
    for y in 0..<height {
      let row = base.advanced(by: y * stride).assumingMemoryBound(to: Float.self)
      for x in 0..<width where row[x] > 0.5 { count += 1 }
    }
  } else {
    // OneComponent8 and friends.
    for y in 0..<height {
      let row = base.advanced(by: y * stride).assumingMemoryBound(to: UInt8.self)
      for x in 0..<width where row[x] > 127 { count += 1 }
    }
  }
  return count
}

var instances = observation.allInstances

if subjectMode == "largest" && instances.count > 1 {
  var best = instances.first!
  var bestArea = -1
  for index in instances {
    guard let mask = try? observation.generateScaledMaskForImage(
      forInstances: IndexSet(integer: index), from: handler) else { continue }
    let area = maskArea(mask)
    if area > bestArea {
      bestArea = area
      best = index
    }
  }
  instances = IndexSet(integer: best)
}

do {
  // croppedToInstancesExtent: false keeps the original canvas size, so a batch
  // of outputs stays dimensionally consistent with its inputs.
  let masked = try observation.generateMaskedImage(
    ofInstances: instances, from: handler, croppedToInstancesExtent: false)

  let ciImage = CIImage(cvPixelBuffer: masked)
  try ciContext.writePNGRepresentation(
    of: ciImage,
    to: outputURL,
    format: .RGBA8,
    colorSpace: CGColorSpaceCreateDeviceRGB(),
    options: [:])
} catch {
  fail(6, "could not write output: \(error.localizedDescription)")
}

exit(0)
