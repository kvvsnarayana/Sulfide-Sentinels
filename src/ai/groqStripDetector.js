/**
 * Groq Vision Physical H2S Sensor Panel Detection & Cropping Engine
 * Sends compressed image frames to /api/analyze-strip and validates bounding box response.
 */

/**
 * Pre-processes canvas/image by resizing to max dimension 1280px and compressing to JPEG
 */
export function compressAndResizeImage(source, maxDimension = 1280, quality = 0.80) {
  let srcW, srcH;

  if (source instanceof HTMLCanvasElement) {
    srcW = source.width;
    srcH = source.height;
  } else if (source instanceof HTMLImageElement) {
    srcW = source.naturalWidth || source.width;
    srcH = source.naturalHeight || source.height;
  } else if (source && source.width && source.height) {
    srcW = source.width;
    srcH = source.height;
  } else {
    throw new Error('Invalid image source passed to compressAndResizeImage.');
  }

  let targetW = srcW;
  let targetH = srcH;

  if (Math.max(srcW, srcH) > maxDimension) {
    const scale = maxDimension / Math.max(srcW, srcH);
    targetW = Math.round(srcW * scale);
    targetH = Math.round(srcH * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, targetW, targetH);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64Clean = compressedDataUrl.replace(/^data:image\/(jpeg|png|webp);base64,/, '');

  return {
    dataUrl: compressedDataUrl,
    base64: base64Clean,
    width: targetW,
    height: targetH,
    originalWidth: srcW,
    originalHeight: srcH
  };
}

/**
 * Validates logical and boundary integrity of Groq response object
 */
export function validateGroqDetectionResponse(response, imageWidth, imageHeight) {
  if (!response || typeof response !== 'object') {
    return { isValid: false, reason: 'Groq API returned non-object response.' };
  }

  if (response.stripDetected !== true) {
    return {
      isValid: false,
      reason: response.reason || 'No physical H₂S sensor panel detected in the image.'
    };
  }

  let confidence = Number(String(response.confidence ?? 1.0).replace('%', ''));
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100;

  let x = Number(String(response.x ?? 0).replace('%', ''));
  if (x > 1 && x <= 100) x = x / 100;

  let y = Number(String(response.y ?? 0).replace('%', ''));
  if (y > 1 && y <= 100) y = y / 100;

  let width = Number(String(response.width ?? 0).replace('%', ''));
  if (width > 1 && width <= 100) width = width / 100;

  let height = Number(String(response.height ?? 0).replace('%', ''));
  if (height > 1 && height <= 100) height = height / 100;

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { isValid: false, reason: 'Invalid or missing detection confidence value.' };
  }

  if (!Number.isFinite(x) || x < 0 || x > 1) {
    return { isValid: false, reason: 'Invalid x bounding box coordinate.' };
  }

  if (!Number.isFinite(y) || y < 0 || y > 1) {
    return { isValid: false, reason: 'Invalid y bounding box coordinate.' };
  }

  if (!Number.isFinite(width) || width <= 0 || width > 1) {
    return { isValid: false, reason: 'Invalid width bounding box coordinate.' };
  }

  if (!Number.isFinite(height) || height <= 0 || height > 1) {
    return { isValid: false, reason: 'Invalid height bounding box coordinate.' };
  }

  if (x + width > 1.05) {
    return { isValid: false, reason: 'Bounding box exceeds right image boundary.' };
  }

  if (y + height > 1.05) {
    return { isValid: false, reason: 'Bounding box exceeds bottom image boundary.' };
  }

  // Gracefully clamp slight rounding overflows (e.g. x=0.20, width=0.805)
  const clampedX = Math.max(0, Math.min(0.99, x));
  const clampedY = Math.max(0, Math.min(0.99, y));
  const clampedW = Math.max(0.01, Math.min(1.0 - clampedX, width));
  const clampedH = Math.max(0.01, Math.min(1.0 - clampedY, height));

  // Check pixel dimensions of crop
  if (imageWidth > 0 && imageHeight > 0) {
    const cropPixelW = clampedW * imageWidth;
    const cropPixelH = clampedH * imageHeight;

    if (cropPixelW < 20 || cropPixelH < 8) {
      return { isValid: false, reason: 'Detected sensor panel crop is too small for reliable optical analysis.' };
    }
  }

  return {
    isValid: true,
    confidence,
    x: clampedX,
    y: clampedY,
    width: clampedW,
    height: clampedH,
    orientation: response.orientation || 'horizontal',
    reason: response.reason || 'Physical H₂S sensor panel successfully detected.'
  };
}

/**
 * Invokes Groq Vision endpoint /api/analyze-strip and validates detection
 */
export async function detectSensorPanelWithGroq(sourceCanvasOrImage) {
  try {
    const compressed = compressAndResizeImage(sourceCanvasOrImage, 1280, 0.80);

    const apiRes = await fetch('/api/analyze-strip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: compressed.base64 })
    });

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      return {
        stripDetected: false,
        confidence: 0,
        reason: errData.error || 'Visual detection unavailable. Please try again.',
        errorType: 'API_ERROR'
      };
    }

    const json = await apiRes.json();
    const validation = validateGroqDetectionResponse(json, compressed.originalWidth, compressed.originalHeight);

    if (!validation.isValid) {
      return {
        stripDetected: false,
        confidence: 0,
        reason: validation.reason,
        rawResponse: json,
        errorType: 'NO_STRIP'
      };
    }

    return {
      stripDetected: true,
      confidence: validation.confidence,
      boundingBoxNormalized: {
        x: validation.x,
        y: validation.y,
        width: validation.width,
        height: validation.height
      },
      orientation: validation.orientation,
      reason: validation.reason,
      compressedMeta: compressed
    };
  } catch (err) {
    console.error('[GROQ STRIP DETECTOR CLIENT ERROR]:', err);
    return {
      stripDetected: false,
      confidence: 0,
      reason: 'Visual detection unavailable. Please try again.',
      errorType: 'API_ERROR'
    };
  }
}

/**
 * Crops ONLY the detected sensor panel from full canvas based on normalized bounding box
 */
export function cropSensorPanel(sourceCanvas, boundingBoxNormalized, marginPercent = 0.02) {
  if (!sourceCanvas || !boundingBoxNormalized) return null;

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  let normX = boundingBoxNormalized.x;
  let normY = boundingBoxNormalized.y;
  let normW = boundingBoxNormalized.width;
  let normH = boundingBoxNormalized.height;

  // Add margin
  const marginX = normW * marginPercent;
  const marginY = normH * marginPercent;

  normX = Math.max(0, normX - marginX);
  normY = Math.max(0, normY - marginY);
  normW = Math.min(1 - normX, normW + marginX * 2);
  normH = Math.min(1 - normY, normH + marginY * 2);

  const pxX = Math.round(normX * srcW);
  const pxY = Math.round(normY * srcH);
  const pxW = Math.max(10, Math.round(normW * srcW));
  const pxH = Math.max(10, Math.round(normH * srcH));

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = pxW;
  croppedCanvas.height = pxH;
  const croppedCtx = croppedCanvas.getContext('2d');

  croppedCtx.drawImage(
    sourceCanvas,
    pxX, pxY, pxW, pxH,
    0, 0, pxW, pxH
  );

  return {
    croppedCanvas,
    croppedCtx,
    croppedWidth: pxW,
    croppedHeight: pxH,
    boundingBoxPixels: { x: pxX, y: pxY, w: pxW, h: pxH },
    originalWidth: srcW,
    originalHeight: srcH
  };
}
