// src/core/errors.ts
var SecureMetadataError = class extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
  }
  code;
  name = "SecureMetadataError";
};
var BinaryBoundsError = class extends SecureMetadataError {
  constructor(code, inputLength, offset, requestedLength) {
    super(
      `Invalid binary range: offset ${String(offset)}, length ${String(requestedLength)}, input length ${String(inputLength)}.`,
      code
    );
    this.inputLength = inputLength;
    this.offset = offset;
    this.requestedLength = requestedLength;
  }
  inputLength;
  offset;
  requestedLength;
  name = "BinaryBoundsError";
};
var InvalidParseLimitError = class extends SecureMetadataError {
  constructor(limitName, value) {
    super(
      `Parse limit ${limitName} must be a non-negative safe integer; received ${String(value)}.`,
      "INVALID_LIMIT"
    );
    this.limitName = limitName;
    this.value = value;
  }
  limitName;
  value;
  name = "InvalidParseLimitError";
};
var InputLimitExceededError = class extends SecureMetadataError {
  constructor(inputLength, maximumLength) {
    super(
      `Input length ${String(inputLength)} exceeds maxInputBytes ${String(maximumLength)}.`,
      "INPUT_LIMIT_EXCEEDED"
    );
    this.inputLength = inputLength;
    this.maximumLength = maximumLength;
  }
  inputLength;
  maximumLength;
  name = "InputLimitExceededError";
};
var UnsupportedFormatError = class extends SecureMetadataError {
  constructor(operation, format) {
    super(
      `${operation} does not support ${format} input.`,
      "UNSUPPORTED_FORMAT"
    );
    this.operation = operation;
    this.format = format;
  }
  operation;
  format;
  name = "UnsupportedFormatError";
};
var IncompleteJpegError = class extends SecureMetadataError {
  constructor(operation, diagnostics) {
    super(
      `${operation} requires a structurally complete JPEG ending at EOI.`,
      "INCOMPLETE_JPEG"
    );
    this.operation = operation;
    this.diagnostics = diagnostics;
  }
  operation;
  diagnostics;
  name = "IncompleteJpegError";
};
var IncompleteWebPError = class extends SecureMetadataError {
  constructor(operation, diagnostics) {
    super(
      `${operation} requires a structurally complete WebP RIFF container.`,
      "INCOMPLETE_WEBP"
    );
    this.operation = operation;
    this.diagnostics = diagnostics;
  }
  operation;
  diagnostics;
  name = "IncompleteWebPError";
};
var IncompletePngError = class extends SecureMetadataError {
  constructor(operation, diagnostics) {
    super(
      `${operation} requires a structurally complete PNG ending at IEND.`,
      "INCOMPLETE_PNG"
    );
    this.operation = operation;
    this.diagnostics = diagnostics;
  }
  operation;
  diagnostics;
  name = "IncompletePngError";
};

// src/core/binary/bounds.ts
function hasValidRange(inputLength, offset, length) {
  return Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0 && offset <= inputLength && length <= inputLength - offset;
}
function assertValidRange(inputLength, offset, length) {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new BinaryBoundsError("INVALID_OFFSET", inputLength, offset, length);
  }
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new BinaryBoundsError("INVALID_LENGTH", inputLength, offset, length);
  }
  if (offset > inputLength || length > inputLength - offset) {
    throw new BinaryBoundsError("OUT_OF_BOUNDS", inputLength, offset, length);
  }
}

// src/core/binary/byte-reader.ts
var ByteReader = class {
  length;
  #bytes;
  #view;
  constructor(bytes) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.length = bytes.byteLength;
  }
  has(offset, length = 1) {
    return hasValidRange(this.length, offset, length);
  }
  u8(offset) {
    assertValidRange(this.length, offset, 1);
    return this.#view.getUint8(offset);
  }
  u16LE(offset) {
    assertValidRange(this.length, offset, 2);
    return this.#view.getUint16(offset, true);
  }
  u16BE(offset) {
    assertValidRange(this.length, offset, 2);
    return this.#view.getUint16(offset, false);
  }
  u32LE(offset) {
    assertValidRange(this.length, offset, 4);
    return this.#view.getUint32(offset, true);
  }
  u32BE(offset) {
    assertValidRange(this.length, offset, 4);
    return this.#view.getUint32(offset, false);
  }
  /** Returns a bounded view, not a copy, after validating the complete range. */
  slice(offset, length) {
    assertValidRange(this.length, offset, length);
    return this.#bytes.subarray(offset, offset + length);
  }
  matches(offset, signature) {
    if (!this.has(offset, signature.length)) {
      return false;
    }
    for (let index = 0; index < signature.length; index += 1) {
      if (this.#bytes[offset + index] !== signature[index]) {
        return false;
      }
    }
    return true;
  }
};

// src/core/binary/input.ts
function toUint8Array(input) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

// src/core/detect-format.ts
var PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
var JPEG_SIGNATURE = [255, 216];
var RIFF_SIGNATURE = [82, 73, 70, 70];
var WEBP_SIGNATURE = [87, 69, 66, 80];
function detectFormat(reader) {
  if (reader.matches(0, PNG_SIGNATURE)) {
    return "png";
  }
  if (reader.matches(0, JPEG_SIGNATURE)) {
    return "jpeg";
  }
  if (reader.matches(0, RIFF_SIGNATURE) && reader.matches(8, WEBP_SIGNATURE)) {
    return "webp";
  }
  return "unknown";
}

// src/core/limits.ts
var DEFAULT_PARSE_LIMITS = Object.freeze({
  maxInputBytes: 100 * 1024 * 1024,
  maxSegments: 4096,
  maxChunks: 4096,
  maxMetadataEntries: 1e4,
  maxIfdDepth: 16,
  maxIfdEntries: 4096,
  maxStringBytes: 4 * 1024 * 1024,
  maxDecompressedBytes: 16 * 1024 * 1024,
  maxDiagnostics: 256
});
function resolveParseLimit(name, configured) {
  const value = configured ?? DEFAULT_PARSE_LIMITS[name];
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidParseLimitError(name, value);
  }
  return value;
}

// src/exif/metadata.ts
function metadataEntriesFromTiff(result, context) {
  return result.entries.map((entry) => ({
    id: `${context.idPrefix}-${String(entry.entryOffset)}-${entry.tag.toString(16)}`,
    namespace: entry.namespace,
    name: entry.name,
    category: entry.category,
    privacy: entry.privacy,
    ...entry.value === void 0 ? {} : { value: entry.value },
    source: {
      format: context.format,
      container: "tiff-ifd",
      offset: context.baseOffset + entry.entryOffset,
      length: 12,
      tiffPath: entry.path,
      tiffTag: entry.tag,
      tiffType: entry.type,
      tiffCount: entry.count
    }
  }));
}
function relocateTiffDiagnostics(diagnostics, baseOffset) {
  return diagnostics.map(
    (item) => item.offset === void 0 ? item : { ...item, offset: baseOffset + item.offset }
  );
}

// src/exif/field-types.ts
var TIFF_FIELD_TYPE = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  UNDEFINED: 7,
  SLONG: 9,
  SRATIONAL: 10
};
var FIELD_TYPE_SIZES = {
  [TIFF_FIELD_TYPE.BYTE]: 1,
  [TIFF_FIELD_TYPE.ASCII]: 1,
  [TIFF_FIELD_TYPE.SHORT]: 2,
  [TIFF_FIELD_TYPE.LONG]: 4,
  [TIFF_FIELD_TYPE.RATIONAL]: 8,
  [TIFF_FIELD_TYPE.UNDEFINED]: 1,
  [TIFF_FIELD_TYPE.SLONG]: 4,
  [TIFF_FIELD_TYPE.SRATIONAL]: 8
};
function tiffFieldTypeSize(type) {
  return FIELD_TYPE_SIZES[type];
}

// src/exif/decode-value.ts
var MAX_DECODED_COMPONENTS = 1024;
function scalarOrArray(values) {
  if (values.length === 1) {
    const value = values[0];
    if (value !== void 0) {
      return value;
    }
  }
  return values;
}
function ascii(reader, offset, count) {
  let result = "";
  for (let index = 0; index < count; index += 1) {
    const byte = reader.u8(offset + index);
    if (byte === 0) {
      break;
    }
    result += byte <= 127 ? String.fromCharCode(byte) : "?";
  }
  return result;
}
function unsignedValues(reader, offset, count, width) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const componentOffset = offset + index * width;
    values.push(
      width === 1 ? reader.u8(componentOffset) : width === 2 ? reader.u16(componentOffset) : reader.u32(componentOffset)
    );
  }
  return scalarOrArray(values);
}
function signedLongValues(reader, offset, count) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push(reader.i32(offset + index * 4));
  }
  return scalarOrArray(values);
}
function rationalValues(reader, offset, count, signed) {
  const diagnostics = [];
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const componentOffset = offset + index * 8;
    const numerator = signed ? reader.i32(componentOffset) : reader.u32(componentOffset);
    const denominator = signed ? reader.i32(componentOffset + 4) : reader.u32(componentOffset + 4);
    values.push({ numerator, denominator });
    if (denominator === 0) {
      diagnostics.push({
        severity: "error",
        code: "TIFF_INVALID_RATIONAL",
        message: "TIFF rational value has a zero denominator.",
        offset: componentOffset + 4
      });
    }
  }
  return { value: scalarOrArray(values), diagnostics };
}
function decodeTiffValue(reader, type, count, valueOffset, definition) {
  if (count > MAX_DECODED_COMPONENTS && type !== TIFF_FIELD_TYPE.ASCII) {
    return {
      diagnostics: [
        {
          severity: "error",
          code: "TIFF_INVALID_VALUE_RANGE",
          message: `TIFF value has too many components to decode (${String(count)}).`,
          offset: valueOffset
        }
      ]
    };
  }
  if (definition.special === "exif-version") {
    return { value: ascii(reader, valueOffset, count), diagnostics: [] };
  }
  if (definition.special === "gps-version") {
    const components = [];
    for (let index = 0; index < count; index += 1) {
      components.push(reader.u8(valueOffset + index));
    }
    return { value: components.join("."), diagnostics: [] };
  }
  switch (type) {
    case TIFF_FIELD_TYPE.ASCII:
      return { value: ascii(reader, valueOffset, count), diagnostics: [] };
    case TIFF_FIELD_TYPE.BYTE:
    case TIFF_FIELD_TYPE.UNDEFINED:
      return {
        value: unsignedValues(reader, valueOffset, count, 1),
        diagnostics: []
      };
    case TIFF_FIELD_TYPE.SHORT:
      return {
        value: unsignedValues(reader, valueOffset, count, 2),
        diagnostics: []
      };
    case TIFF_FIELD_TYPE.LONG:
      return {
        value: unsignedValues(reader, valueOffset, count, 4),
        diagnostics: []
      };
    case TIFF_FIELD_TYPE.SLONG:
      return {
        value: signedLongValues(reader, valueOffset, count),
        diagnostics: []
      };
    case TIFF_FIELD_TYPE.RATIONAL:
      return rationalValues(reader, valueOffset, count, false);
    case TIFF_FIELD_TYPE.SRATIONAL:
      return rationalValues(reader, valueOffset, count, true);
    default:
      return { diagnostics: [] };
  }
}

// src/exif/tags.ts
var TIFF_TAG = {
  IMAGE_DESCRIPTION: 270,
  MAKE: 271,
  MODEL: 272,
  ORIENTATION: 274,
  SOFTWARE: 305,
  DATE_TIME: 306,
  ARTIST: 315,
  COPYRIGHT: 33432,
  EXIF_IFD_POINTER: 34665,
  GPS_IFD_POINTER: 34853,
  EXPOSURE_TIME: 33434,
  F_NUMBER: 33437,
  ISO_SPEED: 34855,
  EXIF_VERSION: 36864,
  DATE_TIME_ORIGINAL: 36867,
  DATE_TIME_DIGITIZED: 36868,
  FOCAL_LENGTH: 37386,
  MAKER_NOTE: 37500,
  PIXEL_X_DIMENSION: 40962,
  PIXEL_Y_DIMENSION: 40963,
  FOCAL_LENGTH_35MM: 41989
};
var IFD0_TAGS = {
  [TIFF_TAG.IMAGE_DESCRIPTION]: {
    name: "ImageDescription",
    namespace: "exif",
    category: "description",
    privacy: "potentially-sensitive"
  },
  [TIFF_TAG.MAKE]: {
    name: "Make",
    namespace: "exif",
    category: "device",
    privacy: "potentially-sensitive"
  },
  [TIFF_TAG.MODEL]: {
    name: "Model",
    namespace: "exif",
    category: "device",
    privacy: "potentially-sensitive"
  },
  [TIFF_TAG.ORIENTATION]: {
    name: "Orientation",
    namespace: "exif",
    category: "technical",
    privacy: "non-sensitive"
  },
  [TIFF_TAG.SOFTWARE]: {
    name: "Software",
    namespace: "exif",
    category: "software",
    privacy: "potentially-sensitive"
  },
  [TIFF_TAG.DATE_TIME]: {
    name: "DateTime",
    namespace: "exif",
    category: "timestamp",
    privacy: "potentially-sensitive"
  },
  [TIFF_TAG.ARTIST]: {
    name: "Artist",
    namespace: "exif",
    category: "identity",
    privacy: "sensitive"
  },
  [TIFF_TAG.COPYRIGHT]: {
    name: "Copyright",
    namespace: "exif",
    category: "rights",
    privacy: "potentially-sensitive"
  }
};
var EXIF_TAGS = {
  [TIFF_TAG.EXPOSURE_TIME]: technical("ExposureTime"),
  [TIFF_TAG.F_NUMBER]: technical("FNumber"),
  [TIFF_TAG.ISO_SPEED]: technical("PhotographicSensitivity"),
  [TIFF_TAG.EXIF_VERSION]: {
    ...technical("ExifVersion"),
    special: "exif-version"
  },
  [TIFF_TAG.DATE_TIME_ORIGINAL]: timestamp("DateTimeOriginal"),
  [TIFF_TAG.DATE_TIME_DIGITIZED]: timestamp("DateTimeDigitized"),
  [TIFF_TAG.FOCAL_LENGTH]: technical("FocalLength"),
  [TIFF_TAG.PIXEL_X_DIMENSION]: technical("PixelXDimension"),
  [TIFF_TAG.PIXEL_Y_DIMENSION]: technical("PixelYDimension"),
  [TIFF_TAG.FOCAL_LENGTH_35MM]: technical("FocalLengthIn35mmFilm"),
  [TIFF_TAG.MAKER_NOTE]: {
    name: "MakerNote",
    namespace: "exif",
    category: "unknown",
    privacy: "potentially-sensitive"
  }
};
var GPS_TAGS = {
  0: {
    name: "GPSVersionID",
    namespace: "gps",
    category: "technical",
    privacy: "non-sensitive",
    special: "gps-version"
  },
  1: location("GPSLatitudeRef"),
  2: location("GPSLatitude"),
  3: location("GPSLongitudeRef"),
  4: location("GPSLongitude"),
  5: location("GPSAltitudeRef"),
  6: location("GPSAltitude"),
  7: {
    name: "GPSTimeStamp",
    namespace: "gps",
    category: "timestamp",
    privacy: "potentially-sensitive"
  },
  29: {
    name: "GPSDateStamp",
    namespace: "gps",
    category: "timestamp",
    privacy: "potentially-sensitive"
  }
};
function technical(name) {
  return {
    name,
    namespace: "exif",
    category: "technical",
    privacy: "non-sensitive"
  };
}
function timestamp(name) {
  return {
    name,
    namespace: "exif",
    category: "timestamp",
    privacy: "potentially-sensitive"
  };
}
function location(name) {
  return {
    name,
    namespace: "gps",
    category: "location",
    privacy: "sensitive"
  };
}
function tiffTagDefinition(kind, tag) {
  const definition = kind === "gps" ? GPS_TAGS[tag] : kind === "exif" ? EXIF_TAGS[tag] : IFD0_TAGS[tag];
  return definition ?? {
    name: `Tag0x${tag.toString(16).toUpperCase().padStart(4, "0")}`,
    namespace: kind === "gps" ? "gps" : "exif",
    category: "unknown",
    privacy: "unknown"
  };
}

// src/exif/tiff-reader.ts
var TiffReader = class {
  length;
  #reader;
  #littleEndian;
  constructor(bytes, byteOrder2) {
    this.#reader = new ByteReader(bytes);
    this.#littleEndian = byteOrder2 === "little";
    this.length = bytes.byteLength;
  }
  has(offset, length = 1) {
    return this.#reader.has(offset, length);
  }
  u8(offset) {
    return this.#reader.u8(offset);
  }
  u16(offset) {
    return this.#littleEndian ? this.#reader.u16LE(offset) : this.#reader.u16BE(offset);
  }
  u32(offset) {
    return this.#littleEndian ? this.#reader.u32LE(offset) : this.#reader.u32BE(offset);
  }
  i32(offset) {
    const value = this.u32(offset);
    return value >= 2147483648 ? value - 4294967296 : value;
  }
};

// src/exif/tiff.ts
function checkedMultiply(left, right) {
  return left <= Math.floor(Number.MAX_SAFE_INTEGER / right) ? left * right : void 0;
}
function emit(state, code, message, offset, severity = "error") {
  if (state.diagnostics.length < state.maxDiagnostics) {
    state.diagnostics.push(
      offset === void 0 ? { severity, code, message } : { severity, code, message, offset }
    );
  }
  if (severity === "error") {
    state.complete = false;
  }
}
function initialFailure(code, message, maxDiagnostics, offset) {
  const diagnostic4 = offset === void 0 ? { severity: "error", code, message } : { severity: "error", code, message, offset };
  return {
    complete: false,
    entries: [],
    diagnostics: maxDiagnostics === 0 ? [] : [diagnostic4]
  };
}
function byteOrder(bytes) {
  if (bytes.matches(0, [73, 73])) {
    return "little";
  }
  if (bytes.matches(0, [77, 77])) {
    return "big";
  }
  return void 0;
}
function queueTarget(reader, state, pending, target, kind, path, depth, sourceOffset, maxTargets) {
  if (target === 0) {
    return;
  }
  if (!reader.has(target, 2)) {
    emit(
      state,
      "TIFF_INVALID_POINTER",
      `TIFF ${path} pointer targets an invalid IFD offset ${String(target)}.`,
      sourceOffset
    );
    return;
  }
  if (pending.length >= maxTargets) {
    if (!state.traversalLimitReported) {
      emit(
        state,
        "TIFF_TRAVERSAL_LIMIT_EXCEEDED",
        `TIFF traversal exceeds maxMetadataEntries ${String(maxTargets)}.`,
        sourceOffset
      );
      state.traversalLimitReported = true;
    }
    return;
  }
  pending.push({ offset: target, kind, path, depth });
}
function parseTiff(bytes, limits) {
  const maxDiagnostics = limits.maxDiagnostics ?? DEFAULT_PARSE_LIMITS.maxDiagnostics;
  const raw = new ByteReader(bytes);
  if (!raw.has(0, 8)) {
    return initialFailure(
      "TIFF_TRUNCATED_HEADER",
      "TIFF header requires at least eight bytes.",
      maxDiagnostics,
      0
    );
  }
  const order = byteOrder(raw);
  if (order === void 0) {
    return initialFailure(
      "TIFF_INVALID_BYTE_ORDER",
      "TIFF byte order must be II or MM.",
      maxDiagnostics,
      0
    );
  }
  const reader = new TiffReader(bytes, order);
  if (reader.u16(2) !== 42) {
    return {
      byteOrder: order,
      complete: false,
      entries: [],
      diagnostics: maxDiagnostics === 0 ? [] : [
        {
          severity: "error",
          code: "TIFF_INVALID_MAGIC",
          message: "TIFF magic value is not 42.",
          offset: 2
        }
      ]
    };
  }
  const firstIfdOffset = reader.u32(4);
  if (firstIfdOffset === 0) {
    return {
      byteOrder: order,
      complete: true,
      entries: [],
      diagnostics: []
    };
  }
  if (!reader.has(firstIfdOffset, 2)) {
    return {
      byteOrder: order,
      complete: false,
      entries: [],
      diagnostics: maxDiagnostics === 0 ? [] : [
        {
          severity: "error",
          code: "TIFF_INVALID_FIRST_IFD_OFFSET",
          message: "TIFF first IFD offset is outside the TIFF payload.",
          offset: 4
        }
      ]
    };
  }
  const state = {
    entries: [],
    diagnostics: [],
    complete: true,
    processedEntries: 0,
    traversalLimitReported: false,
    maxDiagnostics
  };
  const pending = [
    { offset: firstIfdOffset, kind: "ifd0", path: "IFD0", depth: 1 }
  ];
  const visited = /* @__PURE__ */ new Set();
  let queueIndex = 0;
  while (queueIndex < pending.length) {
    const current = pending[queueIndex];
    queueIndex += 1;
    if (current === void 0) {
      break;
    }
    if (visited.has(current.offset)) {
      emit(
        state,
        "TIFF_CYCLIC_IFD",
        `TIFF IFD offset ${String(current.offset)} was already visited.`,
        current.offset
      );
      continue;
    }
    if (current.depth > limits.maxIfdDepth) {
      emit(
        state,
        "TIFF_IFD_DEPTH_LIMIT_EXCEEDED",
        `TIFF IFD depth exceeds maxIfdDepth ${String(limits.maxIfdDepth)}.`,
        current.offset
      );
      continue;
    }
    visited.add(current.offset);
    const entryCount = reader.u16(current.offset);
    if (entryCount > limits.maxIfdEntries) {
      emit(
        state,
        "TIFF_IFD_ENTRY_LIMIT_EXCEEDED",
        `TIFF IFD declares ${String(entryCount)} entries, exceeding maxIfdEntries ${String(limits.maxIfdEntries)}.`,
        current.offset
      );
      continue;
    }
    const entriesByteLength = checkedMultiply(entryCount, 12);
    if (entriesByteLength === void 0) {
      emit(
        state,
        "TIFF_TRUNCATED_IFD",
        "TIFF IFD table size exceeds safe integer arithmetic.",
        current.offset
      );
      continue;
    }
    const tableLength = 2 + entriesByteLength + 4;
    if (!reader.has(current.offset, tableLength)) {
      emit(
        state,
        "TIFF_TRUNCATED_IFD",
        "TIFF IFD table or next-IFD pointer is truncated.",
        current.offset
      );
      continue;
    }
    const exifTargets = [];
    const gpsTargets = [];
    const entriesOffset = current.offset + 2;
    for (let index = 0; index < entryCount; index += 1) {
      if (state.processedEntries >= limits.maxMetadataEntries) {
        if (!state.traversalLimitReported) {
          emit(
            state,
            "TIFF_TRAVERSAL_LIMIT_EXCEEDED",
            `TIFF traversal exceeds maxMetadataEntries ${String(limits.maxMetadataEntries)}.`,
            entriesOffset + index * 12
          );
          state.traversalLimitReported = true;
        }
        break;
      }
      state.processedEntries += 1;
      const entryOffset = entriesOffset + index * 12;
      const tag = reader.u16(entryOffset);
      const type = reader.u16(entryOffset + 2);
      const count = reader.u32(entryOffset + 4);
      const valueFieldOffset = entryOffset + 8;
      const definition = tiffTagDefinition(current.kind, tag);
      const typeSize = tiffFieldTypeSize(type);
      if (typeSize === void 0) {
        emit(
          state,
          "TIFF_UNSUPPORTED_FIELD_TYPE",
          `${definition.name} uses unsupported TIFF field type ${String(type)}.`,
          entryOffset + 2
        );
        state.entries.push({
          tag,
          type,
          count,
          name: definition.name,
          namespace: definition.namespace,
          category: definition.category,
          privacy: definition.privacy,
          path: `${current.path}/${definition.name}`,
          entryOffset,
          valueOffset: valueFieldOffset,
          valueLength: 0
        });
        continue;
      }
      const valueByteLength = checkedMultiply(count, typeSize);
      if (valueByteLength === void 0 || valueByteLength > limits.maxStringBytes) {
        emit(
          state,
          "TIFF_INVALID_VALUE_RANGE",
          `${definition.name} value size is outside configured decoding limits.`,
          entryOffset
        );
        state.entries.push({
          tag,
          type,
          count,
          name: definition.name,
          namespace: definition.namespace,
          category: definition.category,
          privacy: definition.privacy,
          path: `${current.path}/${definition.name}`,
          entryOffset,
          valueOffset: valueFieldOffset,
          valueLength: valueByteLength ?? 0
        });
        continue;
      }
      const valueOffset = valueByteLength <= 4 ? valueFieldOffset : reader.u32(valueFieldOffset);
      if (!reader.has(valueOffset, valueByteLength)) {
        emit(
          state,
          "TIFF_INVALID_VALUE_OFFSET",
          `${definition.name} value range is outside the TIFF payload.`,
          valueFieldOffset
        );
        state.entries.push({
          tag,
          type,
          count,
          name: definition.name,
          namespace: definition.namespace,
          category: definition.category,
          privacy: definition.privacy,
          path: `${current.path}/${definition.name}`,
          entryOffset,
          valueOffset,
          valueLength: valueByteLength
        });
        continue;
      }
      if (tag === TIFF_TAG.EXIF_IFD_POINTER || tag === TIFF_TAG.GPS_IFD_POINTER) {
        if (type !== TIFF_FIELD_TYPE.LONG || count !== 1) {
          emit(
            state,
            "TIFF_INVALID_POINTER",
            `${definition.name} must be LONG with count 1.`,
            entryOffset
          );
          continue;
        }
        const target = reader.u32(valueOffset);
        const collection = tag === TIFF_TAG.EXIF_IFD_POINTER ? exifTargets : gpsTargets;
        collection.push({ target, sourceOffset: valueFieldOffset });
        continue;
      }
      const isOpaque = definition.name === "MakerNote" || definition.name.startsWith("Tag0x");
      const decoded = isOpaque ? { diagnostics: [] } : decodeTiffValue(reader, type, count, valueOffset, definition);
      for (const item of decoded.diagnostics) {
        if (state.diagnostics.length < state.maxDiagnostics) {
          state.diagnostics.push(item);
        }
        if (item.severity === "error") {
          state.complete = false;
        }
      }
      state.entries.push({
        tag,
        type,
        count,
        name: definition.name,
        namespace: definition.namespace,
        category: definition.category,
        privacy: definition.privacy,
        ...decoded.value === void 0 ? {} : { value: decoded.value },
        path: `${current.path}/${definition.name}`,
        entryOffset,
        valueOffset,
        valueLength: valueByteLength
      });
    }
    const nextPointerOffset = entriesOffset + entriesByteLength;
    const nextTarget = reader.u32(nextPointerOffset);
    for (const target of exifTargets) {
      queueTarget(
        reader,
        state,
        pending,
        target.target,
        "exif",
        `${current.path}/ExifIFD`,
        current.depth + 1,
        target.sourceOffset,
        limits.maxMetadataEntries
      );
    }
    for (const target of gpsTargets) {
      queueTarget(
        reader,
        state,
        pending,
        target.target,
        "gps",
        `${current.path}/GPSIFD`,
        current.depth + 1,
        target.sourceOffset,
        limits.maxMetadataEntries
      );
    }
    queueTarget(
      reader,
      state,
      pending,
      nextTarget,
      "next",
      current.kind === "ifd0" ? "IFD1" : `${current.path}/NextIFD`,
      current.depth + 1,
      nextPointerOffset,
      limits.maxMetadataEntries
    );
  }
  return {
    byteOrder: order,
    complete: state.complete,
    entries: state.entries,
    diagnostics: state.diagnostics,
    ...state.traversalLimitReported ? { entryLimitExceeded: true } : {}
  };
}

// src/jpeg/markers.ts
var JPEG_MARKER = {
  TEM: 1,
  SOF0: 192,
  SOF1: 193,
  SOF2: 194,
  DHT: 196,
  SOI: 216,
  EOI: 217,
  SOS: 218,
  DQT: 219,
  DRI: 221,
  COM: 254
};
var MARKER_NAMES = {
  [JPEG_MARKER.TEM]: "TEM",
  [JPEG_MARKER.SOF0]: "SOF0",
  [JPEG_MARKER.SOF1]: "SOF1",
  [JPEG_MARKER.SOF2]: "SOF2",
  [JPEG_MARKER.DHT]: "DHT",
  [JPEG_MARKER.SOI]: "SOI",
  [JPEG_MARKER.EOI]: "EOI",
  [JPEG_MARKER.SOS]: "SOS",
  [JPEG_MARKER.DQT]: "DQT",
  [JPEG_MARKER.DRI]: "DRI",
  [JPEG_MARKER.COM]: "COM"
};
function isApplicationMarker(marker) {
  return marker >= 224 && marker <= 239;
}
function isRestartMarker(marker) {
  return marker >= 208 && marker <= 215;
}
function isStandaloneMarker(marker) {
  return marker === JPEG_MARKER.TEM || marker === JPEG_MARKER.SOI || marker === JPEG_MARKER.EOI || isRestartMarker(marker);
}
function isValidMarkerCode(marker) {
  return marker === JPEG_MARKER.TEM || marker >= 192 && marker <= 254;
}
function markerName(marker) {
  if (isApplicationMarker(marker)) {
    return `APP${String(marker - 224)}`;
  }
  if (isRestartMarker(marker)) {
    return `RST${String(marker - 208)}`;
  }
  return MARKER_NAMES[marker] ?? `UNKNOWN_${marker.toString(16).toUpperCase()}`;
}

// src/jpeg/metadata.ts
function source(segment) {
  return {
    format: "jpeg",
    container: "jpeg-segment",
    offset: segment.offset,
    length: segment.length,
    jpegMarker: segment.marker
  };
}
function inspectJpegMetadata(reader, result, tiffLimits, maxMetadataEntries) {
  const entries = [];
  const diagnostics = [];
  let attemptedExifDecode = false;
  let entryLimitExceeded = false;
  const add = (entry) => {
    if (entries.length >= maxMetadataEntries) {
      entryLimitExceeded = true;
      return false;
    }
    entries.push(entry);
    return true;
  };
  for (const segment of result.segments) {
    if (segment.marker === JPEG_MARKER.COM) {
      add({
        id: `jpeg-comment-${String(segment.offset)}`,
        namespace: "jpeg-comment",
        name: "JPEG comment",
        category: "description",
        privacy: "potentially-sensitive",
        source: source(segment)
      });
      continue;
    }
    switch (segment.metadataKind) {
      case "exif": {
        if (!add({
          id: `jpeg-exif-${String(segment.offset)}`,
          namespace: "exif",
          name: "EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment)
        }) || segment.payloadOffset === void 0 || segment.payloadLength === void 0) {
          break;
        }
        attemptedExifDecode = true;
        const tiffOffset = segment.payloadOffset + 6;
        const tiffLength = segment.payloadLength - 6;
        const tiff = parseTiff(reader.slice(tiffOffset, tiffLength), {
          ...tiffLimits,
          maxMetadataEntries: maxMetadataEntries - entries.length,
          maxDiagnostics: (tiffLimits.maxDiagnostics ?? DEFAULT_PARSE_LIMITS.maxDiagnostics) - diagnostics.length
        });
        entries.push(
          ...metadataEntriesFromTiff(tiff, {
            format: "jpeg",
            baseOffset: tiffOffset,
            idPrefix: `jpeg-tiff-${String(segment.offset)}`
          })
        );
        diagnostics.push(
          ...relocateTiffDiagnostics(tiff.diagnostics, tiffOffset)
        );
        entryLimitExceeded ||= tiff.entryLimitExceeded === true;
        break;
      }
      case "xmp":
        add({
          id: `jpeg-xmp-${String(segment.offset)}`,
          namespace: "xmp",
          name: segment.metadataSubtype === "extended-xmp" ? "Extended XMP container" : "XMP container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment)
        });
        break;
      case "icc":
        add({
          id: `jpeg-icc-${String(segment.offset)}`,
          namespace: "icc",
          name: "ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source: source(segment)
        });
        break;
      case "iptc":
        add({
          id: `jpeg-iptc-${String(segment.offset)}`,
          namespace: "iptc",
          name: "Photoshop/IPTC container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source(segment)
        });
        break;
    }
  }
  return {
    entries,
    diagnostics,
    attemptedExifDecode,
    entryLimitExceeded
  };
}

// src/jpeg/classify.ts
var JFIF_SIGNATURE = [74, 70, 73, 70, 0];
var JFXX_SIGNATURE = [74, 70, 88, 88, 0];
var EXIF_SIGNATURE = [69, 120, 105, 102, 0, 0];
var XMP_SIGNATURE = [
  104,
  116,
  116,
  112,
  58,
  47,
  47,
  110,
  115,
  46,
  97,
  100,
  111,
  98,
  101,
  46,
  99,
  111,
  109,
  47,
  120,
  97,
  112,
  47,
  49,
  46,
  48,
  47,
  0
];
var EXTENDED_XMP_SIGNATURE = [
  104,
  116,
  116,
  112,
  58,
  47,
  47,
  110,
  115,
  46,
  97,
  100,
  111,
  98,
  101,
  46,
  99,
  111,
  109,
  47,
  120,
  109,
  112,
  47,
  101,
  120,
  116,
  101,
  110,
  115,
  105,
  111,
  110,
  47,
  0
];
var ICC_SIGNATURE = [
  73,
  67,
  67,
  95,
  80,
  82,
  79,
  70,
  73,
  76,
  69,
  0
];
var PHOTOSHOP_SIGNATURE = [
  80,
  104,
  111,
  116,
  111,
  115,
  104,
  111,
  112,
  32,
  51,
  46,
  48,
  0
];
var ADOBE_SIGNATURE = [65, 100, 111, 98, 101];
function matchesPayload(reader, payloadOffset, payloadLength, signature) {
  return signature.length <= payloadLength && reader.matches(payloadOffset, signature);
}
function classifySegmentKind(marker) {
  if (marker >= 224 && marker <= 239) {
    return "application";
  }
  if (marker === JPEG_MARKER.COM) {
    return "comment";
  }
  if (marker === JPEG_MARKER.SOS) {
    return "scan";
  }
  if (marker === JPEG_MARKER.TEM || marker === JPEG_MARKER.SOI || marker === JPEG_MARKER.EOI || marker >= 208 && marker <= 215) {
    return "standalone";
  }
  if (marker >= 192 && marker <= 223) {
    return "image-structure";
  }
  return "unknown";
}
function classifyApplicationSegment(reader, marker, payloadOffset, payloadLength) {
  if (marker === 224) {
    if (matchesPayload(reader, payloadOffset, payloadLength, JFIF_SIGNATURE)) {
      return { metadataKind: "jfif", metadataSubtype: "jfif" };
    }
    if (matchesPayload(reader, payloadOffset, payloadLength, JFXX_SIGNATURE)) {
      return { metadataKind: "jfif", metadataSubtype: "jfxx" };
    }
  }
  if (marker === 225) {
    if (matchesPayload(reader, payloadOffset, payloadLength, EXIF_SIGNATURE)) {
      return { metadataKind: "exif" };
    }
    if (matchesPayload(reader, payloadOffset, payloadLength, XMP_SIGNATURE)) {
      return { metadataKind: "xmp", metadataSubtype: "standard-xmp" };
    }
    if (matchesPayload(
      reader,
      payloadOffset,
      payloadLength,
      EXTENDED_XMP_SIGNATURE
    )) {
      return { metadataKind: "xmp", metadataSubtype: "extended-xmp" };
    }
  }
  if (marker === 226 && matchesPayload(reader, payloadOffset, payloadLength, ICC_SIGNATURE)) {
    return { metadataKind: "icc" };
  }
  if (marker === 237 && matchesPayload(reader, payloadOffset, payloadLength, PHOTOSHOP_SIGNATURE)) {
    return { metadataKind: "iptc", metadataSubtype: "photoshop" };
  }
  if (marker === 238 && matchesPayload(reader, payloadOffset, payloadLength, ADOBE_SIGNATURE)) {
    return { metadataKind: "adobe" };
  }
  return { metadataKind: "unknown" };
}

// src/jpeg/parser.ts
function addDiagnostic(state, ...items) {
  const remaining = state.maxDiagnostics - state.diagnostics.length;
  if (remaining > 0) {
    state.diagnostics.push(...items.slice(0, remaining));
  }
}
function diagnostic(severity, code, message, offset) {
  return offset === void 0 ? { severity, code, message } : { severity, code, message, offset };
}
function readMarker(reader, offset) {
  if (reader.u8(offset) !== 255) {
    return diagnostic(
      "error",
      "JPEG_INVALID_MARKER",
      "Expected a JPEG marker prefix.",
      offset
    );
  }
  let cursor = offset;
  while (reader.has(cursor) && reader.u8(cursor) === 255) {
    cursor += 1;
  }
  if (!reader.has(cursor)) {
    return diagnostic(
      "error",
      "JPEG_TRUNCATED_MARKER",
      "JPEG input ends within marker fill bytes.",
      offset
    );
  }
  const marker = reader.u8(cursor);
  if (marker === 0 || !isValidMarkerCode(marker)) {
    return diagnostic(
      "error",
      "JPEG_INVALID_MARKER",
      `Invalid JPEG marker code 0x${marker.toString(16).padStart(2, "0")}.`,
      cursor
    );
  }
  return {
    marker,
    markerOffset: cursor - 1,
    rangeOffset: offset,
    afterMarker: cursor + 1
  };
}
function addSegment(state, segment, maxSegments) {
  if (state.segments.length >= maxSegments) {
    addDiagnostic(
      state,
      diagnostic(
        "error",
        "JPEG_SEGMENT_LIMIT_EXCEEDED",
        `JPEG marker count exceeds maxSegments ${String(maxSegments)}.`,
        segment.offset
      )
    );
    return false;
  }
  state.segments.push(segment);
  return true;
}
function incompleteResult(state, sawSoi) {
  return {
    segments: state.segments,
    complete: false,
    sawSoi,
    sawEoi: false,
    diagnostics: state.diagnostics
  };
}
function skipScanData(reader, scanOffset, state, maxSegments) {
  let cursor = scanOffset;
  while (reader.has(cursor)) {
    if (reader.u8(cursor) !== 255) {
      cursor += 1;
      continue;
    }
    const fillStart = cursor;
    cursor += 1;
    while (reader.has(cursor) && reader.u8(cursor) === 255) {
      cursor += 1;
    }
    if (!reader.has(cursor)) {
      addDiagnostic(
        state,
        diagnostic(
          "error",
          "JPEG_TRUNCATED_SCAN",
          "JPEG entropy-coded scan ends within marker fill bytes.",
          fillStart
        )
      );
      return void 0;
    }
    const marker = reader.u8(cursor);
    if (marker === 0) {
      cursor += 1;
      continue;
    }
    if (isRestartMarker(marker)) {
      const markerOffset = cursor - 1;
      if (!addSegment(
        state,
        {
          marker,
          markerName: markerName(marker),
          offset: markerOffset,
          length: 2,
          rangeOffset: fillStart,
          rangeLength: cursor + 1 - fillStart,
          kind: "standalone"
        },
        maxSegments
      )) {
        return void 0;
      }
      cursor += 1;
      continue;
    }
    return cursor - 1;
  }
  addDiagnostic(
    state,
    diagnostic(
      "error",
      "JPEG_TRUNCATED_SCAN",
      "JPEG entropy-coded scan reaches EOF before a terminating marker.",
      scanOffset
    )
  );
  return void 0;
}
function parseJpeg(reader, maxSegments, maxDiagnostics = DEFAULT_PARSE_LIMITS.maxDiagnostics) {
  const state = { segments: [], diagnostics: [], maxDiagnostics };
  if (!reader.matches(0, [255, JPEG_MARKER.SOI])) {
    addDiagnostic(
      state,
      diagnostic(
        "error",
        "JPEG_INVALID_SOI",
        "JPEG input does not begin with the SOI marker.",
        0
      )
    );
    return incompleteResult(state, false);
  }
  if (!addSegment(
    state,
    {
      marker: JPEG_MARKER.SOI,
      markerName: "SOI",
      offset: 0,
      length: 2,
      rangeOffset: 0,
      rangeLength: 2,
      kind: "standalone"
    },
    maxSegments
  )) {
    return incompleteResult(state, true);
  }
  let offset = 2;
  while (reader.has(offset)) {
    const markerResult = readMarker(reader, offset);
    if ("severity" in markerResult) {
      addDiagnostic(state, markerResult);
      return incompleteResult(state, true);
    }
    const { marker, markerOffset, rangeOffset, afterMarker } = markerResult;
    if (marker === JPEG_MARKER.SOI) {
      addDiagnostic(
        state,
        diagnostic(
          "error",
          "JPEG_INVALID_MARKER",
          "Unexpected SOI marker inside JPEG container.",
          markerOffset
        )
      );
      return incompleteResult(state, true);
    }
    if (isStandaloneMarker(marker)) {
      if (!addSegment(
        state,
        {
          marker,
          markerName: markerName(marker),
          offset: markerOffset,
          length: 2,
          rangeOffset,
          rangeLength: afterMarker - rangeOffset,
          kind: "standalone"
        },
        maxSegments
      )) {
        return incompleteResult(state, true);
      }
      offset = afterMarker;
      if (marker === JPEG_MARKER.EOI) {
        if (offset < reader.length) {
          addDiagnostic(
            state,
            diagnostic(
              "warning",
              "JPEG_TRAILING_DATA",
              `JPEG contains ${String(reader.length - offset)} trailing byte(s) after EOI.`,
              offset
            )
          );
        }
        return {
          segments: state.segments,
          complete: true,
          sawSoi: true,
          sawEoi: true,
          diagnostics: state.diagnostics
        };
      }
      continue;
    }
    if (!reader.has(afterMarker, 2)) {
      addDiagnostic(
        state,
        diagnostic(
          "error",
          "JPEG_TRUNCATED_SEGMENT_LENGTH",
          `${markerName(marker)} is missing its two-byte segment length.`,
          afterMarker
        )
      );
      return incompleteResult(state, true);
    }
    const declaredLength = reader.u16BE(afterMarker);
    if (declaredLength < 2) {
      addDiagnostic(
        state,
        diagnostic(
          "error",
          "JPEG_INVALID_SEGMENT_LENGTH",
          `${markerName(marker)} declares invalid length ${String(declaredLength)}.`,
          afterMarker
        )
      );
      return incompleteResult(state, true);
    }
    if (!reader.has(afterMarker, declaredLength)) {
      addDiagnostic(
        state,
        diagnostic(
          "error",
          "JPEG_TRUNCATED_SEGMENT",
          `${markerName(marker)} extends beyond the JPEG input.`,
          markerOffset
        )
      );
      return incompleteResult(state, true);
    }
    const payloadOffset = afterMarker + 2;
    const payloadLength = declaredLength - 2;
    const segmentEnd = afterMarker + declaredLength;
    const classification = isApplicationMarker(marker) ? classifyApplicationSegment(reader, marker, payloadOffset, payloadLength) : void 0;
    const segment = {
      marker,
      markerName: markerName(marker),
      offset: markerOffset,
      length: declaredLength + 2,
      rangeOffset,
      rangeLength: segmentEnd - rangeOffset,
      payloadOffset,
      payloadLength,
      kind: classifySegmentKind(marker),
      ...classification ?? {}
    };
    if (!addSegment(state, segment, maxSegments)) {
      return incompleteResult(state, true);
    }
    offset = segmentEnd;
    if (marker === JPEG_MARKER.SOS) {
      const nextMarkerOffset = skipScanData(
        reader,
        segmentEnd,
        state,
        maxSegments
      );
      if (nextMarkerOffset === void 0) {
        return incompleteResult(state, true);
      }
      offset = nextMarkerOffset;
    }
  }
  addDiagnostic(
    state,
    diagnostic(
      "error",
      "JPEG_MISSING_EOI",
      "JPEG input ends before an EOI marker.",
      reader.length
    )
  );
  return incompleteResult(state, true);
}

// src/png/metadata.ts
function source2(chunk) {
  return {
    format: "png",
    container: "png-chunk",
    offset: chunk.offset,
    length: chunk.totalLength,
    chunkType: chunk.fourCC
  };
}
function inspectPngMetadata(reader, result, tiffLimits, maxMetadataEntries) {
  const entries = [];
  const diagnostics = [];
  let attemptedExifDecode = false;
  let entryLimitExceeded = false;
  const add = (entry) => {
    if (entries.length >= maxMetadataEntries) {
      entryLimitExceeded = true;
      return false;
    }
    entries.push(entry);
    return true;
  };
  for (const chunk of result.chunks) {
    switch (chunk.metadataKind) {
      case "exif": {
        if (!add({
          id: `png-exif-${String(chunk.offset)}`,
          namespace: "exif",
          name: "PNG EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source2(chunk)
        })) {
          break;
        }
        attemptedExifDecode = true;
        const tiff = parseTiff(
          reader.slice(chunk.dataOffset, chunk.dataLength),
          {
            ...tiffLimits,
            maxMetadataEntries: maxMetadataEntries - entries.length,
            maxDiagnostics: (tiffLimits.maxDiagnostics ?? DEFAULT_PARSE_LIMITS.maxDiagnostics) - diagnostics.length
          }
        );
        entries.push(
          ...metadataEntriesFromTiff(tiff, {
            format: "png",
            baseOffset: chunk.dataOffset,
            idPrefix: `png-tiff-${String(chunk.offset)}`
          })
        );
        diagnostics.push(
          ...relocateTiffDiagnostics(tiff.diagnostics, chunk.dataOffset)
        );
        entryLimitExceeded ||= tiff.entryLimitExceeded === true;
        break;
      }
      case "xmp":
        add({
          id: `png-xmp-${String(chunk.offset)}`,
          namespace: "xmp",
          name: "PNG XMP iTXt container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source2(chunk)
        });
        break;
      case "text":
        add({
          id: `png-text-${String(chunk.offset)}`,
          namespace: "png-text",
          name: chunk.keyword === void 0 ? `${chunk.fourCC} metadata` : `${chunk.fourCC} metadata (${chunk.keyword})`,
          category: "description",
          privacy: "potentially-sensitive",
          source: source2(chunk)
        });
        break;
      case "timestamp":
        add({
          id: `png-time-${String(chunk.offset)}`,
          namespace: "png-time",
          name: "PNG modification time",
          category: "timestamp",
          privacy: "potentially-sensitive",
          source: source2(chunk)
        });
        break;
      case "icc":
        add({
          id: `png-icc-${String(chunk.offset)}`,
          namespace: "icc",
          name: "PNG ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source: source2(chunk)
        });
        break;
    }
  }
  return {
    entries,
    diagnostics,
    attemptedExifDecode,
    entryLimitExceeded
  };
}

// src/png/crc32.ts
function pngCrc32(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
    }
  }
  return (crc ^ 4294967295) >>> 0;
}

// src/png/parser.ts
var PNG_SIGNATURE2 = [137, 80, 78, 71, 13, 10, 26, 10];
var XMP_KEYWORD = "XML:com.adobe.xmp";
function addDiagnostic2(diagnostics, maximum, ...items) {
  const remaining = maximum - diagnostics.length;
  if (remaining > 0) {
    diagnostics.push(...items.slice(0, remaining));
  }
}
function diagnostic2(severity, code, message, offset) {
  return offset === void 0 ? { severity, code, message } : { severity, code, message, offset };
}
function failure(diagnostics, chunks = [], containerLength = 0) {
  return {
    chunks,
    complete: false,
    sawIend: false,
    containerLength,
    diagnostics
  };
}
function fourCC(reader, offset) {
  return String.fromCharCode(
    reader.u8(offset),
    reader.u8(offset + 1),
    reader.u8(offset + 2),
    reader.u8(offset + 3)
  );
}
function isAsciiLetter(value) {
  return value >= 65 && value <= 90 || value >= 97 && value <= 122;
}
function classifyChunk(fourCC3, ancillary) {
  switch (fourCC3) {
    case "IDAT":
      return { kind: "image" };
    case "IHDR":
    case "PLTE":
    case "IEND":
      return { kind: "critical" };
    case "eXIf":
      return { kind: "metadata", metadataKind: "exif" };
    case "iCCP":
      return { kind: "metadata", metadataKind: "icc" };
    case "tIME":
      return { kind: "metadata", metadataKind: "timestamp" };
    case "tEXt":
    case "zTXt":
    case "iTXt":
      return { kind: "metadata", metadataKind: "text" };
    case "gAMA":
    case "cHRM":
    case "sRGB":
    case "sBIT":
    case "pHYs":
      return { kind: "color" };
    case "acTL":
    case "fcTL":
    case "fdAT":
      return { kind: "animation" };
    default:
      return { kind: ancillary ? "unknown" : "critical" };
  }
}
function readKeyword(reader, dataOffset, dataLength, maxStringBytes, diagnostics, maxDiagnostics, fourCC3) {
  const keywordLimit = Math.min(maxStringBytes, 79);
  const scanLength = Math.min(dataLength, keywordLimit + 1);
  for (let index = 0; index < scanLength; index += 1) {
    if (reader.u8(dataOffset + index) !== 0) {
      continue;
    }
    if (index === 0) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "warning",
          "PNG_INVALID_TEXT",
          `${fourCC3} has an empty text keyword.`,
          dataOffset
        )
      );
      return void 0;
    }
    const characters = [];
    for (let keywordIndex = 0; keywordIndex < index; keywordIndex += 1) {
      characters.push(reader.u8(dataOffset + keywordIndex));
    }
    return {
      value: String.fromCharCode(...characters),
      afterKeyword: dataOffset + index + 1
    };
  }
  addDiagnostic2(
    diagnostics,
    maxDiagnostics,
    dataLength > keywordLimit && keywordLimit === maxStringBytes ? diagnostic2(
      "warning",
      "PNG_TEXT_LIMIT_EXCEEDED",
      `${fourCC3} keyword exceeds maxStringBytes ${String(maxStringBytes)}.`,
      dataOffset
    ) : diagnostic2(
      "warning",
      "PNG_INVALID_TEXT",
      `${fourCC3} text keyword is not NUL-terminated.`,
      dataOffset
    )
  );
  return void 0;
}
function parsePng(reader, maxChunks, maxStringBytes, maxDiagnostics = DEFAULT_PARSE_LIMITS.maxDiagnostics) {
  const diagnostics = [];
  const chunks = [];
  if (!reader.matches(0, PNG_SIGNATURE2)) {
    addDiagnostic2(
      diagnostics,
      maxDiagnostics,
      diagnostic2(
        "error",
        "PNG_INVALID_SIGNATURE",
        "PNG input does not contain the complete eight-byte signature.",
        0
      )
    );
    return failure(diagnostics);
  }
  let offset = 8;
  while (offset < reader.length) {
    if (chunks.length >= maxChunks) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "error",
          "PNG_CHUNK_LIMIT_EXCEEDED",
          `PNG chunk count exceeds maxChunks ${String(maxChunks)}.`,
          offset
        )
      );
      return failure(diagnostics, chunks, offset);
    }
    const remaining = reader.length - offset;
    if (remaining < 4) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "error",
          "PNG_TRUNCATED_CHUNK_LENGTH",
          "PNG input ends within a chunk length field.",
          offset
        )
      );
      return failure(diagnostics, chunks, offset);
    }
    if (remaining < 8) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "error",
          "PNG_TRUNCATED_CHUNK_TYPE",
          "PNG input ends within a chunk type field.",
          offset + 4
        )
      );
      return failure(diagnostics, chunks, offset);
    }
    const dataLength = reader.u32BE(offset);
    const typeOffset = offset + 4;
    for (let index = 0; index < 4; index += 1) {
      if (!isAsciiLetter(reader.u8(typeOffset + index))) {
        addDiagnostic2(
          diagnostics,
          maxDiagnostics,
          diagnostic2(
            "error",
            "PNG_INVALID_CHUNK_TYPE",
            "PNG chunk types must contain four ASCII letters.",
            typeOffset
          )
        );
        return failure(diagnostics, chunks, offset);
      }
    }
    const type = fourCC(reader, typeOffset);
    const dataOffset = offset + 8;
    const available = reader.length - dataOffset;
    if (dataLength > available) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "error",
          "PNG_TRUNCATED_CHUNK_DATA",
          `${type} data extends beyond the supplied input.`,
          offset
        )
      );
      return failure(diagnostics, chunks, offset);
    }
    if (available - dataLength < 4) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "error",
          "PNG_MISSING_CRC",
          `${type} is missing its complete CRC field.`,
          dataOffset + dataLength
        )
      );
      return failure(diagnostics, chunks, offset);
    }
    const crcOffset = dataOffset + dataLength;
    const totalLength = 12 + dataLength;
    if (!Number.isSafeInteger(totalLength) || totalLength > remaining) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "error",
          "PNG_TRUNCATED_CHUNK_DATA",
          `${type} physical chunk range is invalid.`,
          offset
        )
      );
      return failure(diagnostics, chunks, offset);
    }
    const ancillary = (reader.u8(typeOffset) & 32) !== 0;
    const classification = classifyChunk(type, ancillary);
    let keyword;
    let textCompressed;
    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const parsedKeyword = readKeyword(
        reader,
        dataOffset,
        dataLength,
        maxStringBytes,
        diagnostics,
        maxDiagnostics,
        type
      );
      keyword = parsedKeyword?.value;
      if (type === "zTXt") {
        textCompressed = true;
        if (parsedKeyword !== void 0 && parsedKeyword.afterKeyword >= dataOffset + dataLength) {
          addDiagnostic2(
            diagnostics,
            maxDiagnostics,
            diagnostic2(
              "warning",
              "PNG_INVALID_TEXT",
              "zTXt is missing its compression method byte.",
              parsedKeyword.afterKeyword
            )
          );
        }
      } else if (type === "iTXt" && parsedKeyword !== void 0) {
        if (dataOffset + dataLength - parsedKeyword.afterKeyword < 2) {
          addDiagnostic2(
            diagnostics,
            maxDiagnostics,
            diagnostic2(
              "warning",
              "PNG_INVALID_TEXT",
              "iTXt is missing compression flag or method bytes.",
              parsedKeyword.afterKeyword
            )
          );
        } else {
          const flag = reader.u8(parsedKeyword.afterKeyword);
          textCompressed = flag === 1;
          if (flag > 1) {
            addDiagnostic2(
              diagnostics,
              maxDiagnostics,
              diagnostic2(
                "warning",
                "PNG_INVALID_TEXT",
                "iTXt compression flag must be zero or one.",
                parsedKeyword.afterKeyword
              )
            );
          }
        }
      }
    }
    const expectedCrc = reader.u32BE(crcOffset);
    const actualCrc = pngCrc32(reader.slice(typeOffset, 4 + dataLength));
    const crcValid = expectedCrc === actualCrc;
    if (!crcValid) {
      addDiagnostic2(
        diagnostics,
        maxDiagnostics,
        diagnostic2(
          "warning",
          "PNG_INVALID_CRC",
          `${type} CRC does not match its type and data.`,
          crcOffset
        )
      );
    }
    const chunk = {
      fourCC: type,
      offset,
      dataOffset,
      dataLength,
      totalLength,
      ancillary,
      ...classification,
      ...type === "iTXt" && keyword === XMP_KEYWORD ? { metadataKind: "xmp" } : {},
      ...keyword === void 0 ? {} : { keyword },
      ...textCompressed === void 0 ? {} : { textCompressed },
      crcValid
    };
    chunks.push(chunk);
    offset += totalLength;
    if (type === "IEND") {
      if (dataLength !== 0) {
        addDiagnostic2(
          diagnostics,
          maxDiagnostics,
          diagnostic2(
            "error",
            "PNG_INVALID_IEND",
            "IEND must have an empty data field.",
            chunk.dataOffset
          )
        );
        return failure(diagnostics, chunks, offset);
      }
      if (offset < reader.length) {
        addDiagnostic2(
          diagnostics,
          maxDiagnostics,
          diagnostic2(
            "warning",
            "PNG_TRAILING_DATA",
            `PNG contains ${String(reader.length - offset)} trailing byte(s) after IEND.`,
            offset
          )
        );
      }
      return {
        chunks,
        complete: true,
        sawIend: true,
        containerLength: offset,
        diagnostics
      };
    }
  }
  addDiagnostic2(
    diagnostics,
    maxDiagnostics,
    diagnostic2(
      "error",
      "PNG_MISSING_IEND",
      "PNG input ends before an IEND chunk.",
      reader.length
    )
  );
  return failure(diagnostics, chunks, reader.length);
}

// src/webp/metadata.ts
function inspectWebPMetadata(result, maxMetadataEntries) {
  const entries = [];
  let entryLimitExceeded = false;
  for (const chunk of result.chunks) {
    if (chunk.metadataKind === void 0) {
      continue;
    }
    if (entries.length >= maxMetadataEntries) {
      entryLimitExceeded = true;
      continue;
    }
    const source3 = {
      format: "webp",
      container: "webp-chunk",
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC
    };
    switch (chunk.metadataKind) {
      case "exif":
        entries.push({
          id: `webp-exif-${String(chunk.offset)}`,
          namespace: "exif",
          name: "WebP EXIF container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source3
        });
        break;
      case "xmp":
        entries.push({
          id: `webp-xmp-${String(chunk.offset)}`,
          namespace: "xmp",
          name: "WebP XMP container",
          category: "unknown",
          privacy: "potentially-sensitive",
          source: source3
        });
        break;
      case "icc":
        entries.push({
          id: `webp-icc-${String(chunk.offset)}`,
          namespace: "icc",
          name: "WebP ICC profile container",
          category: "color",
          privacy: "non-sensitive",
          source: source3
        });
        break;
    }
  }
  return { entries, entryLimitExceeded };
}

// src/webp/chunks.ts
var WEBP_VP8X_FLAG = Object.freeze({
  icc: 32,
  alpha: 16,
  exif: 8,
  xmp: 4,
  animation: 2
});
var WEBP_VP8X_METADATA_MASK = WEBP_VP8X_FLAG.icc | WEBP_VP8X_FLAG.exif | WEBP_VP8X_FLAG.xmp;
function classifyWebPChunk(fourCC3) {
  switch (fourCC3) {
    case "VP8 ":
    case "VP8L":
      return { kind: "image" };
    case "ALPH":
      return { kind: "alpha" };
    case "VP8X":
      return { kind: "extended" };
    case "ANIM":
    case "ANMF":
      return { kind: "animation" };
    case "EXIF":
      return { kind: "metadata", metadataKind: "exif" };
    case "XMP ":
      return { kind: "metadata", metadataKind: "xmp" };
    case "ICCP":
      return { kind: "metadata", metadataKind: "icc" };
    default:
      return { kind: "unknown" };
  }
}

// src/webp/parser.ts
var RIFF = [82, 73, 70, 70];
var WEBP = [87, 69, 66, 80];
function diagnostic3(severity, code, message, offset) {
  return offset === void 0 ? { severity, code, message } : { severity, code, message, offset };
}
function failure2(diagnostics, chunks = [], containerLength = 0) {
  return { chunks, complete: false, containerLength, diagnostics };
}
function fourCC2(reader, offset) {
  return String.fromCharCode(
    reader.u8(offset),
    reader.u8(offset + 1),
    reader.u8(offset + 2),
    reader.u8(offset + 3)
  );
}
function parseWebP(reader, maxChunks, maxDiagnostics = DEFAULT_PARSE_LIMITS.maxDiagnostics) {
  const diagnostics = [];
  const chunks = [];
  let hasStructuralError = false;
  const addDiagnostic3 = (...items) => {
    hasStructuralError ||= items.some(({ severity }) => severity === "error");
    const remaining = maxDiagnostics - diagnostics.length;
    if (remaining > 0) {
      diagnostics.push(...items.slice(0, remaining));
    }
  };
  if (!reader.has(0, 12) || !reader.matches(0, RIFF) || !reader.matches(8, WEBP)) {
    addDiagnostic3(
      diagnostic3(
        "error",
        "WEBP_INVALID_RIFF_HEADER",
        "WebP input requires a 12-byte RIFF....WEBP header.",
        0
      )
    );
    return failure2(diagnostics);
  }
  const declaredRiffSize = reader.u32LE(4);
  const containerLength = declaredRiffSize + 8;
  if (declaredRiffSize < 4 || !Number.isSafeInteger(containerLength) || containerLength < 12) {
    addDiagnostic3(
      diagnostic3(
        "error",
        "WEBP_INVALID_RIFF_SIZE",
        "WebP RIFF size does not include the WEBP form type.",
        4
      )
    );
    return failure2(diagnostics, chunks, containerLength);
  }
  if (containerLength > reader.length) {
    addDiagnostic3(
      diagnostic3(
        "error",
        "WEBP_TRUNCATED_RIFF",
        "WebP RIFF size extends beyond the supplied input.",
        4
      )
    );
    return failure2(diagnostics, chunks, containerLength);
  }
  if (containerLength < reader.length) {
    addDiagnostic3(
      diagnostic3(
        "warning",
        "WEBP_TRAILING_DATA",
        `WebP contains ${String(reader.length - containerLength)} trailing byte(s) after the RIFF container.`,
        containerLength
      )
    );
  }
  let offset = 12;
  let vp8xCount = 0;
  while (offset < containerLength) {
    if (chunks.length >= maxChunks) {
      addDiagnostic3(
        diagnostic3(
          "error",
          "WEBP_CHUNK_LIMIT_EXCEEDED",
          `WebP chunk count exceeds maxChunks ${String(maxChunks)}.`,
          offset
        )
      );
      return failure2(diagnostics, chunks, containerLength);
    }
    if (containerLength - offset < 8) {
      addDiagnostic3(
        diagnostic3(
          "error",
          "WEBP_TRUNCATED_CHUNK_HEADER",
          "WebP RIFF ends within a chunk header.",
          offset
        )
      );
      return failure2(diagnostics, chunks, containerLength);
    }
    const type = fourCC2(reader, offset);
    const payloadLength = reader.u32LE(offset + 4);
    const payloadOffset = offset + 8;
    const payloadEnd = payloadOffset + payloadLength;
    if (!Number.isSafeInteger(payloadEnd) || payloadEnd > containerLength) {
      addDiagnostic3(
        diagnostic3(
          "error",
          "WEBP_TRUNCATED_CHUNK",
          `${type} payload extends beyond the RIFF boundary.`,
          offset
        )
      );
      return failure2(diagnostics, chunks, containerLength);
    }
    const padding = payloadLength % 2;
    if (padding === 1 && payloadEnd === containerLength) {
      addDiagnostic3(
        diagnostic3(
          "error",
          "WEBP_INVALID_PADDING",
          `${type} has an odd payload without its required padding byte.`,
          payloadEnd
        )
      );
      return failure2(diagnostics, chunks, containerLength);
    }
    const totalLength = 8 + payloadLength + padding;
    if (!Number.isSafeInteger(totalLength) || totalLength > containerLength - offset) {
      addDiagnostic3(
        diagnostic3(
          "error",
          "WEBP_TRUNCATED_CHUNK",
          `${type} physical chunk range exceeds the RIFF boundary.`,
          offset
        )
      );
      return failure2(diagnostics, chunks, containerLength);
    }
    const classification = classifyWebPChunk(type);
    let vp8xFlags;
    if (type === "VP8X") {
      vp8xCount += 1;
      if (vp8xCount > 1) {
        addDiagnostic3(
          diagnostic3(
            "error",
            "WEBP_DUPLICATE_VP8X",
            "WebP contains more than one VP8X chunk.",
            offset
          )
        );
      }
      if (payloadLength !== 10) {
        addDiagnostic3(
          diagnostic3(
            "error",
            "WEBP_INVALID_VP8X",
            "VP8X payload must be exactly 10 bytes.",
            offset
          )
        );
      } else {
        vp8xFlags = reader.u8(payloadOffset);
      }
    }
    chunks.push({
      fourCC: type,
      offset,
      payloadOffset,
      payloadLength,
      totalLength,
      ...classification,
      ...vp8xFlags === void 0 ? {} : { vp8xFlags }
    });
    offset += totalLength;
  }
  const vp8x = chunks.find(({ fourCC: type }) => type === "VP8X");
  if (!hasStructuralError && vp8x?.vp8xFlags !== void 0) {
    const observedFlags = (chunks.some(({ metadataKind }) => metadataKind === "icc") ? WEBP_VP8X_FLAG.icc : 0) | (chunks.some(({ metadataKind }) => metadataKind === "exif") ? WEBP_VP8X_FLAG.exif : 0) | (chunks.some(({ metadataKind }) => metadataKind === "xmp") ? WEBP_VP8X_FLAG.xmp : 0);
    if ((vp8x.vp8xFlags & WEBP_VP8X_METADATA_MASK) !== observedFlags) {
      addDiagnostic3(
        diagnostic3(
          "warning",
          "WEBP_INCONSISTENT_FEATURE_FLAGS",
          "VP8X metadata flags do not match observed metadata chunks.",
          vp8x.payloadOffset
        )
      );
    }
  }
  return {
    chunks,
    complete: !hasStructuralError,
    containerLength,
    diagnostics
  };
}

// src/inspect.ts
function resolveTiffLimits(limits, enabled) {
  return {
    maxIfdEntries: enabled ? resolveParseLimit("maxIfdEntries", limits?.maxIfdEntries) : DEFAULT_PARSE_LIMITS.maxIfdEntries,
    maxIfdDepth: enabled ? resolveParseLimit("maxIfdDepth", limits?.maxIfdDepth) : DEFAULT_PARSE_LIMITS.maxIfdDepth,
    maxMetadataEntries: enabled ? resolveParseLimit("maxMetadataEntries", limits?.maxMetadataEntries) : DEFAULT_PARSE_LIMITS.maxMetadataEntries,
    maxStringBytes: enabled ? resolveParseLimit("maxStringBytes", limits?.maxStringBytes) : DEFAULT_PARSE_LIMITS.maxStringBytes,
    maxDiagnostics: enabled ? resolveParseLimit("maxDiagnostics", limits?.maxDiagnostics) : DEFAULT_PARSE_LIMITS.maxDiagnostics
  };
}
function boundedDiagnostics(diagnostics, entryLimitExceeded, maxDiagnostics) {
  const withEntryLimit = entryLimitExceeded ? [
    {
      severity: "warning",
      code: "METADATA_ENTRY_LIMIT_EXCEEDED",
      message: "Metadata report exceeds the configured maxMetadataEntries limit."
    },
    ...diagnostics
  ] : diagnostics;
  return withEntryLimit.slice(0, maxDiagnostics);
}
function inspectMetadata(input, options) {
  const bytes = toUint8Array(input);
  const maxInputBytes = resolveParseLimit(
    "maxInputBytes",
    options?.limits?.maxInputBytes
  );
  if (bytes.byteLength > maxInputBytes) {
    throw new InputLimitExceededError(bytes.byteLength, maxInputBytes);
  }
  const reader = new ByteReader(bytes);
  const format = detectFormat(reader);
  if (format === "jpeg") {
    const maxMetadataEntries = resolveParseLimit(
      "maxMetadataEntries",
      options?.limits?.maxMetadataEntries
    );
    const maxDiagnostics = resolveParseLimit(
      "maxDiagnostics",
      options?.limits?.maxDiagnostics
    );
    const jpeg = parseJpeg(
      reader,
      resolveParseLimit("maxSegments", options?.limits?.maxSegments),
      maxDiagnostics
    );
    const hasExif = jpeg.segments.some(
      ({ metadataKind }) => metadataKind === "exif"
    );
    const metadata = inspectJpegMetadata(
      reader,
      jpeg,
      resolveTiffLimits(options?.limits, hasExif),
      maxMetadataEntries
    );
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: !jpeg.complete ? "container-partial" : metadata.attemptedExifDecode ? "metadata-partial" : "container-inspected",
      entries: metadata.entries,
      ...metadata.entryLimitExceeded ? { metadataTruncated: true } : {},
      diagnostics: boundedDiagnostics(
        [...jpeg.diagnostics, ...metadata.diagnostics],
        metadata.entryLimitExceeded,
        maxDiagnostics
      )
    };
  }
  if (format === "webp") {
    const maxMetadataEntries = resolveParseLimit(
      "maxMetadataEntries",
      options?.limits?.maxMetadataEntries
    );
    const maxDiagnostics = resolveParseLimit(
      "maxDiagnostics",
      options?.limits?.maxDiagnostics
    );
    const webp = parseWebP(
      reader,
      resolveParseLimit("maxChunks", options?.limits?.maxChunks),
      maxDiagnostics
    );
    const metadata = inspectWebPMetadata(webp, maxMetadataEntries);
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: webp.complete ? "container-inspected" : "container-partial",
      entries: metadata.entries,
      ...metadata.entryLimitExceeded ? { metadataTruncated: true } : {},
      diagnostics: boundedDiagnostics(
        webp.diagnostics,
        metadata.entryLimitExceeded,
        maxDiagnostics
      )
    };
  }
  if (format === "png") {
    const maxMetadataEntries = resolveParseLimit(
      "maxMetadataEntries",
      options?.limits?.maxMetadataEntries
    );
    const maxDiagnostics = resolveParseLimit(
      "maxDiagnostics",
      options?.limits?.maxDiagnostics
    );
    const png = parsePng(
      reader,
      resolveParseLimit("maxChunks", options?.limits?.maxChunks),
      resolveParseLimit("maxStringBytes", options?.limits?.maxStringBytes),
      maxDiagnostics
    );
    const hasExif = png.chunks.some(
      ({ metadataKind }) => metadataKind === "exif"
    );
    const metadata = inspectPngMetadata(
      reader,
      png,
      resolveTiffLimits(options?.limits, hasExif),
      maxMetadataEntries
    );
    return {
      format,
      size: bytes.byteLength,
      inspectionStatus: !png.complete ? "container-partial" : metadata.attemptedExifDecode ? "metadata-partial" : "container-inspected",
      entries: metadata.entries,
      ...metadata.entryLimitExceeded ? { metadataTruncated: true } : {},
      diagnostics: boundedDiagnostics(
        [...png.diagnostics, ...metadata.diagnostics],
        metadata.entryLimitExceeded,
        maxDiagnostics
      )
    };
  }
  return {
    format,
    size: bytes.byteLength,
    inspectionStatus: "format-only",
    entries: [],
    diagnostics: []
  };
}

// src/policy/normalize.ts
var DEFAULT_CLEANING_POLICY = Object.freeze({
  removeExif: true,
  removeXmp: true,
  removeIptc: true,
  removeComments: true,
  removeTextMetadata: true,
  removeTimestamps: true,
  preserveIcc: true
});
function normalizeCleaningPolicy(policy) {
  return Object.freeze({
    removeExif: policy?.removeExif ?? DEFAULT_CLEANING_POLICY.removeExif,
    removeXmp: policy?.removeXmp ?? DEFAULT_CLEANING_POLICY.removeXmp,
    removeIptc: policy?.removeIptc ?? DEFAULT_CLEANING_POLICY.removeIptc,
    removeComments: policy?.removeComments ?? DEFAULT_CLEANING_POLICY.removeComments,
    removeTextMetadata: policy?.removeTextMetadata ?? DEFAULT_CLEANING_POLICY.removeTextMetadata,
    removeTimestamps: policy?.removeTimestamps ?? DEFAULT_CLEANING_POLICY.removeTimestamps,
    preserveIcc: policy?.preserveIcc ?? policy?.preserveColorProfiles ?? DEFAULT_CLEANING_POLICY.preserveIcc
  });
}

// src/png/clean.ts
var DEFAULT_PNG_CLEANING_POLICY = DEFAULT_CLEANING_POLICY;
function shouldRemove(chunk, policy) {
  switch (chunk.metadataKind) {
    case "exif":
      return policy.removeExif;
    case "xmp":
      return policy.removeXmp;
    case "text":
      return policy.removeTextMetadata;
    case "timestamp":
      return policy.removeTimestamps;
    case "icc":
      return !policy.preserveIcc;
    default:
      return false;
  }
}
function changeFor(chunk, action) {
  let namespace = "unknown";
  let name = `Unknown ${chunk.fourCC} chunk`;
  switch (chunk.metadataKind) {
    case "exif":
      namespace = "exif";
      name = "PNG EXIF container";
      break;
    case "xmp":
      namespace = "xmp";
      name = "PNG XMP iTXt container";
      break;
    case "text":
      namespace = "png-text";
      name = `${chunk.fourCC} metadata`;
      break;
    case "timestamp":
      namespace = "png-time";
      name = "PNG modification time";
      break;
    case "icc":
      namespace = "icc";
      name = "PNG ICC profile container";
      break;
  }
  return {
    namespace,
    action,
    name,
    source: {
      format: "png",
      container: "png-chunk",
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC
    }
  };
}
function outputError(message) {
  return new SecureMetadataError(message, "CLEAN_OUTPUT_SIZE_INVALID");
}
function cleanPng(bytes, policy) {
  const parsed = parsePng(
    new ByteReader(bytes),
    resolveParseLimit("maxChunks", policy?.limits?.maxChunks),
    resolveParseLimit("maxStringBytes", policy?.limits?.maxStringBytes),
    resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics)
  );
  if (!parsed.complete) {
    throw new IncompletePngError(
      "cleanMetadata",
      parsed.diagnostics.slice(
        0,
        resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics)
      )
    );
  }
  const resolved = normalizeCleaningPolicy(policy);
  const removals = parsed.chunks.filter(
    (chunk) => shouldRemove(chunk, resolved)
  );
  const retained = parsed.chunks.filter(
    (chunk) => !shouldRemove(chunk, resolved)
  );
  let containerLength = 8;
  for (const chunk of retained) {
    containerLength += chunk.totalLength;
    if (!Number.isSafeInteger(containerLength) || containerLength > parsed.containerLength) {
      throw outputError("PNG cleaner output container size is invalid.");
    }
  }
  const trailingLength = bytes.byteLength - parsed.containerLength;
  const outputLength = containerLength + trailingLength;
  if (!Number.isSafeInteger(outputLength) || outputLength < 8 || outputLength > bytes.byteLength) {
    throw outputError("PNG cleaner output size is invalid.");
  }
  const output = new Uint8Array(outputLength);
  output.set(bytes.subarray(0, 8));
  let outputOffset = 8;
  for (const chunk of retained) {
    output.set(
      bytes.subarray(chunk.offset, chunk.offset + chunk.totalLength),
      outputOffset
    );
    outputOffset += chunk.totalLength;
  }
  output.set(bytes.subarray(parsed.containerLength), outputOffset);
  const report = inspectMetadata(
    output,
    policy?.limits === void 0 ? void 0 : { limits: policy.limits }
  );
  if (report.inspectionStatus === "container-partial") {
    throw new IncompletePngError("cleanMetadata", report.diagnostics);
  }
  return {
    output,
    format: "png",
    report,
    removed: removals.map((chunk) => changeFor(chunk, "removed")),
    preserved: retained.filter(
      ({ kind, metadataKind }) => kind === "unknown" || metadataKind !== void 0
    ).map((chunk) => changeFor(chunk, "preserved")),
    diagnostics: report.diagnostics
  };
}

// src/webp/clean.ts
var DEFAULT_WEBP_CLEANING_POLICY = DEFAULT_CLEANING_POLICY;
function shouldRemove2(chunk, policy) {
  switch (chunk.metadataKind) {
    case "exif":
      return policy.removeExif;
    case "xmp":
      return policy.removeXmp;
    case "icc":
      return !policy.preserveIcc;
    default:
      return false;
  }
}
function changeFor2(chunk, action) {
  let namespace = "unknown";
  let name = `Unknown ${chunk.fourCC} chunk`;
  if (chunk.metadataKind !== void 0) {
    namespace = chunk.metadataKind;
    name = chunk.metadataKind === "icc" ? "WebP ICC profile container" : `WebP ${chunk.metadataKind.toUpperCase()} container`;
  }
  return {
    namespace,
    action,
    name,
    source: {
      format: "webp",
      container: "webp-chunk",
      offset: chunk.offset,
      length: chunk.totalLength,
      chunkType: chunk.fourCC
    }
  };
}
function outputError2(message) {
  return new SecureMetadataError(message, "CLEAN_OUTPUT_SIZE_INVALID");
}
function cleanWebP(bytes, policy) {
  const parsed = parseWebP(
    new ByteReader(bytes),
    resolveParseLimit("maxChunks", policy?.limits?.maxChunks),
    resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics)
  );
  if (!parsed.complete) {
    throw new IncompleteWebPError(
      "cleanMetadata",
      parsed.diagnostics.slice(
        0,
        resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics)
      )
    );
  }
  const resolved = normalizeCleaningPolicy(policy);
  const removals = parsed.chunks.filter(
    (chunk) => shouldRemove2(chunk, resolved)
  );
  const retained = parsed.chunks.filter(
    (chunk) => !shouldRemove2(chunk, resolved)
  );
  let containerLength = 12;
  for (const chunk of retained) {
    containerLength += chunk.totalLength;
    if (!Number.isSafeInteger(containerLength) || containerLength > parsed.containerLength) {
      throw outputError2("WebP cleaner output RIFF size is invalid.");
    }
  }
  const trailingLength = bytes.byteLength - parsed.containerLength;
  const outputLength = containerLength + trailingLength;
  if (!Number.isSafeInteger(outputLength) || outputLength < 12 || outputLength > bytes.byteLength) {
    throw outputError2("WebP cleaner output size is invalid.");
  }
  const hasIcc = retained.some(({ metadataKind }) => metadataKind === "icc");
  const hasExif = retained.some(({ metadataKind }) => metadataKind === "exif");
  const hasXmp = retained.some(({ metadataKind }) => metadataKind === "xmp");
  const metadataFlags = (hasIcc ? WEBP_VP8X_FLAG.icc : 0) | (hasExif ? WEBP_VP8X_FLAG.exif : 0) | (hasXmp ? WEBP_VP8X_FLAG.xmp : 0);
  const output = new Uint8Array(outputLength);
  output.set(bytes.subarray(0, 12));
  new DataView(output.buffer).setUint32(4, containerLength - 8, true);
  let outputOffset = 12;
  for (const chunk of retained) {
    output.set(
      bytes.subarray(chunk.offset, chunk.offset + chunk.totalLength),
      outputOffset
    );
    if (chunk.vp8xFlags !== void 0) {
      output[outputOffset + 8] = chunk.vp8xFlags & ~WEBP_VP8X_METADATA_MASK | metadataFlags;
    }
    outputOffset += chunk.totalLength;
  }
  output.set(bytes.subarray(parsed.containerLength), outputOffset);
  const report = inspectMetadata(
    output,
    policy?.limits === void 0 ? void 0 : { limits: policy.limits }
  );
  if (report.inspectionStatus === "container-partial") {
    throw new IncompleteWebPError("cleanMetadata", report.diagnostics);
  }
  return {
    output,
    format: "webp",
    report,
    removed: removals.map((chunk) => changeFor2(chunk, "removed")),
    preserved: retained.filter(
      ({ kind, metadataKind }) => kind === "unknown" || metadataKind !== void 0
    ).map((chunk) => changeFor2(chunk, "preserved")),
    diagnostics: report.diagnostics
  };
}

// src/policy/clean.ts
var DEFAULT_JPEG_CLEANING_POLICY = DEFAULT_CLEANING_POLICY;
function shouldRemove3(segment, policy) {
  if (segment.kind === "comment") {
    return policy.removeComments;
  }
  switch (segment.metadataKind) {
    case "exif":
      return policy.removeExif;
    case "xmp":
      return policy.removeXmp;
    case "iptc":
      return policy.removeIptc;
    case "icc":
      return !policy.preserveIcc;
    default:
      return false;
  }
}
function changeFor3(segment, action) {
  let namespace = "container";
  let name = segment.markerName;
  if (segment.kind === "comment") {
    namespace = "jpeg-comment";
    name = "JPEG comment";
  } else {
    switch (segment.metadataKind) {
      case "exif":
        namespace = "exif";
        name = "EXIF container";
        break;
      case "xmp":
        namespace = "xmp";
        name = segment.metadataSubtype === "extended-xmp" ? "Extended XMP container" : "XMP container";
        break;
      case "iptc":
        namespace = "iptc";
        name = "Photoshop/IPTC container";
        break;
      case "icc":
        namespace = "icc";
        name = "ICC profile container";
        break;
      case "jfif":
        name = segment.metadataSubtype === "jfxx" ? "JFXX application segment" : "JFIF application segment";
        break;
      case "adobe":
        name = "Adobe application segment";
        break;
      case "unknown":
        namespace = "unknown";
        name = `Unknown ${segment.markerName} application segment`;
        break;
    }
  }
  return {
    namespace,
    action,
    name,
    source: {
      format: "jpeg",
      container: "jpeg-segment",
      offset: segment.offset,
      length: segment.length,
      jpegMarker: segment.marker
    }
  };
}
function copyWithoutSegments(input, removals) {
  const retained = [];
  let inputOffset = 0;
  let outputLength = 0;
  for (const segment of removals) {
    const end = segment.rangeOffset + segment.rangeLength;
    if (!Number.isSafeInteger(segment.rangeOffset) || !Number.isSafeInteger(segment.rangeLength) || segment.rangeLength <= 0 || !Number.isSafeInteger(end) || segment.rangeOffset < inputOffset || end > input.byteLength) {
      throw new SecureMetadataError(
        "JPEG cleaner produced an invalid removal range.",
        "CLEAN_OUTPUT_SIZE_INVALID"
      );
    }
    const length = segment.rangeOffset - inputOffset;
    retained.push({ offset: inputOffset, length });
    outputLength += length;
    if (!Number.isSafeInteger(outputLength) || outputLength > input.byteLength) {
      throw new SecureMetadataError(
        "JPEG cleaner output size is invalid.",
        "CLEAN_OUTPUT_SIZE_INVALID"
      );
    }
    inputOffset = end;
  }
  const tailLength = input.byteLength - inputOffset;
  retained.push({ offset: inputOffset, length: tailLength });
  outputLength += tailLength;
  if (!Number.isSafeInteger(outputLength) || outputLength < 0 || outputLength > input.byteLength) {
    throw new SecureMetadataError(
      "JPEG cleaner output size is invalid.",
      "CLEAN_OUTPUT_SIZE_INVALID"
    );
  }
  const output = new Uint8Array(outputLength);
  let outputOffset = 0;
  for (const range of retained) {
    output.set(
      input.subarray(range.offset, range.offset + range.length),
      outputOffset
    );
    outputOffset += range.length;
  }
  return output;
}
function cleanMetadata(input, policy) {
  const bytes = toUint8Array(input);
  const maxInputBytes = resolveParseLimit(
    "maxInputBytes",
    policy?.limits?.maxInputBytes
  );
  if (bytes.byteLength > maxInputBytes) {
    throw new InputLimitExceededError(bytes.byteLength, maxInputBytes);
  }
  const reader = new ByteReader(bytes);
  const format = detectFormat(reader);
  if (format === "png") {
    return cleanPng(bytes, policy);
  }
  if (format === "webp") {
    return cleanWebP(bytes, policy);
  }
  if (format !== "jpeg") {
    throw new UnsupportedFormatError("cleanMetadata", format);
  }
  const jpeg = parseJpeg(
    reader,
    resolveParseLimit("maxSegments", policy?.limits?.maxSegments),
    resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics)
  );
  if (!jpeg.complete) {
    throw new IncompleteJpegError(
      "cleanMetadata",
      jpeg.diagnostics.slice(
        0,
        resolveParseLimit("maxDiagnostics", policy?.limits?.maxDiagnostics)
      )
    );
  }
  const resolved = normalizeCleaningPolicy(policy);
  const removals = jpeg.segments.filter(
    (segment) => shouldRemove3(segment, resolved)
  );
  const removed = removals.map((segment) => changeFor3(segment, "removed"));
  const preserved = jpeg.segments.filter(
    (segment) => (segment.kind === "application" || segment.kind === "comment") && !shouldRemove3(segment, resolved)
  ).map((segment) => changeFor3(segment, "preserved"));
  const output = copyWithoutSegments(bytes, removals);
  const report = inspectMetadata(
    output,
    policy?.limits === void 0 ? void 0 : { limits: policy.limits }
  );
  if (report.inspectionStatus === "container-partial") {
    throw new IncompleteJpegError("cleanMetadata", report.diagnostics);
  }
  return {
    output,
    format: "jpeg",
    report,
    removed,
    preserved,
    diagnostics: report.diagnostics
  };
}

// src/verify/verify.ts
var DEFAULT_JPEG_VERIFICATION_POLICY = Object.freeze({
  exif: "absent",
  xmp: "absent",
  iptc: "absent",
  comments: "absent",
  icc: "ignore"
});
var DEFAULT_WEBP_VERIFICATION_POLICY = Object.freeze({
  exif: "absent",
  xmp: "absent",
  icc: "ignore"
});
var DEFAULT_PNG_VERIFICATION_POLICY = Object.freeze({
  exif: "absent",
  xmp: "absent",
  textMetadata: "absent",
  timestamps: "absent",
  icc: "ignore"
});
function verifyMetadata(input, expectation) {
  const report = inspectMetadata(
    input,
    expectation?.limits === void 0 ? void 0 : { limits: expectation.limits }
  );
  if (report.format === "jpeg") {
    if (report.inspectionStatus === "container-partial") {
      throw new IncompleteJpegError("verifyMetadata", report.diagnostics);
    }
  } else if (report.format === "webp") {
    if (report.inspectionStatus === "container-partial") {
      throw new IncompleteWebPError("verifyMetadata", report.diagnostics);
    }
  } else if (report.format === "png") {
    if (report.inspectionStatus === "container-partial") {
      throw new IncompletePngError("verifyMetadata", report.diagnostics);
    }
  } else {
    throw new UnsupportedFormatError("verifyMetadata", report.format);
  }
  if (report.metadataTruncated === true) {
    return {
      valid: false,
      checks: [],
      report,
      diagnostics: report.diagnostics
    };
  }
  const privacyDefault = expectation?.requireNoPrivacyRelevantMetadata === false ? "ignore" : "absent";
  let expected;
  if (report.format === "jpeg") {
    expected = {
      exif: expectation?.exif ?? privacyDefault,
      xmp: expectation?.xmp ?? privacyDefault,
      iptc: expectation?.iptc ?? privacyDefault,
      "jpeg-comment": expectation?.comments ?? privacyDefault,
      icc: expectation?.icc ?? "ignore"
    };
  } else if (report.format === "webp") {
    expected = {
      exif: expectation?.exif ?? privacyDefault,
      xmp: expectation?.xmp ?? privacyDefault,
      icc: expectation?.icc ?? "ignore"
    };
  } else {
    expected = {
      exif: expectation?.exif ?? privacyDefault,
      xmp: expectation?.xmp ?? privacyDefault,
      "png-text": expectation?.textMetadata ?? privacyDefault,
      "png-time": expectation?.timestamps ?? privacyDefault,
      icc: expectation?.icc ?? "ignore"
    };
  }
  const checks = [];
  for (const [namespace, wanted] of Object.entries(expected)) {
    if (wanted === "ignore") {
      continue;
    }
    const present = report.entries.some(
      (entry) => entry.namespace === namespace
    );
    const actual = present ? "present" : "absent";
    checks.push({
      namespace,
      expected: wanted,
      actual,
      passed: actual === wanted
    });
  }
  return {
    valid: checks.every(({ passed }) => passed),
    checks,
    report,
    diagnostics: report.diagnostics
  };
}
export {
  BinaryBoundsError,
  DEFAULT_CLEANING_POLICY,
  DEFAULT_JPEG_CLEANING_POLICY,
  DEFAULT_JPEG_VERIFICATION_POLICY,
  DEFAULT_PARSE_LIMITS,
  DEFAULT_PNG_CLEANING_POLICY,
  DEFAULT_PNG_VERIFICATION_POLICY,
  DEFAULT_WEBP_CLEANING_POLICY,
  DEFAULT_WEBP_VERIFICATION_POLICY,
  IncompleteJpegError,
  IncompletePngError,
  IncompleteWebPError,
  InputLimitExceededError,
  InvalidParseLimitError,
  SecureMetadataError,
  UnsupportedFormatError,
  cleanMetadata,
  inspectMetadata,
  verifyMetadata
};
//# sourceMappingURL=secure-metadata.js.map