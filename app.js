// Photo-to-WhatsApp OCR Application
// Client-side phone number extraction from images

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  // Check if Tesseract is available
  if (typeof Tesseract === 'undefined') {
    showError('Tesseract.js failed to load. Please check your internet connection and refresh the page. The app needs to download the OCR library from the CDN.', {
      error: document.getElementById('error')
    });
    document.getElementById('processBtn').disabled = true;
    return;
  }

  // DOM Elements
  const elements = {
    fileInput: document.getElementById('fileInput'),
    uploadZone: document.getElementById('uploadZone'),
    previewContainer: document.getElementById('previewContainer'),
    preview: document.getElementById('preview'),
    removeImage: document.getElementById('removeImage'),
    messageTemplate: document.getElementById('messageTemplate'),
    templateSelector: document.getElementById('templateSelector'),
    processBtn: document.getElementById('processBtn'),
    progressSection: document.getElementById('progressSection'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    error: document.getElementById('error'),
    resultsSection: document.getElementById('resultsSection'),
    extractedText: document.getElementById('extractedText'),
    phoneList: document.getElementById('phoneList'),
    phoneCount: document.getElementById('phoneCount'),
    noResults: document.getElementById('noResults')
  };

  // Template definitions
  const templates = {
    full: `【取件】快遞<Item ID>包裹已於<Check-in Date>到達石硤尾白田購物中心驛站D37，免費存放期3天（入庫當天算第一天），請盡快憑取件碼【<Pickup Number>】取件。自提點地址：九龍石硤尾偉智里1-3號白田購物中心地下29號（好佳味手撕雞隔離），營業時間：週一~週日10:00~21:00營業;公衆假期10:00~21:00營業，請在3個營業日内取件。`,
    simple: `請憑取件碼【<Pickup Number>】儘快領取。自提點地址：白田購物中心驛站D37（好佳味手撕雞隔離），營業時間：週一~週日;公衆假期 10:00~21:00`
  };

  // Load saved template preference and text from localStorage
  const savedTemplateType = localStorage.getItem('selectedTemplate');
  const savedMessage = localStorage.getItem('whatsappMessageTemplate');

  if (savedTemplateType && templates[savedTemplateType]) {
    elements.templateSelector.value = savedTemplateType;
    elements.messageTemplate.value = savedMessage || templates[savedTemplateType];
  } else {
    // Default to full template
    elements.messageTemplate.value = templates.full;
  }

  // Handle template selector change
  elements.templateSelector.addEventListener('change', () => {
    const selectedType = elements.templateSelector.value;
    localStorage.setItem('selectedTemplate', selectedType);
    // Update to the template text for this type, but preserve custom edits if they exist?
    // For simplicity: load the default template for this type
    elements.messageTemplate.value = templates[selectedType];
    // Save to localStorage
    localStorage.setItem('whatsappMessageTemplate', templates[selectedType]);
  });

  // Save message template on change
  elements.messageTemplate.addEventListener('change', () => {
    localStorage.setItem('whatsappMessageTemplate', elements.messageTemplate.value);
  });

  // File input change event
  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0], elements);
    }
  });

  // Drag and drop support
  elements.uploadZone.addEventListener('click', () => elements.fileInput.click());

  elements.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadZone.classList.add('drag-active');
  });

  elements.uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-active');
  });

  elements.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-active');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleFileUpload(files[0], elements);
    } else {
      showError('Please drop an image file (JPG, PNG, etc.)', elements);
    }
  });

  // Keyboard support for upload zone
  elements.uploadZone.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elements.fileInput.click();
    }
  });

  // Remove image button
  elements.removeImage.addEventListener('click', () => {
    resetUpload(elements);
  });

  // Process button
  elements.processBtn.addEventListener('click', () => {
    if (elements.preview.src) {
      processImage(elements);
    }
  });

  // Enable process button when image is loaded
  elements.preview.addEventListener('load', () => {
    elements.processBtn.disabled = false;
  });
}

function handleFileUpload(file, elements) {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showError('Please select a valid image file (JPG, PNG, etc.)', elements);
    return;
  }

  // Show preview and keep reference to the file object
  const reader = new FileReader();
  reader.onload = (e) => {
    // Use the data URL directly for preview (no resize needed, CSS will scale it)
    const img = new Image();
    img.onload = () => {
      elements.preview.src = e.target.result;

      // Store the File object reference directly on the element (not dataset)
      elements._currentFile = file;
      // Also create a blob URL for Tesseract (more reliable than File object)
      if (elements._blobUrl) {
        URL.revokeObjectURL(elements._blobUrl);
      }
      elements._blobUrl = URL.createObjectURL(file);

      elements.uploadZone.classList.add('hidden');
      elements.previewContainer.classList.remove('hidden');
      elements.processBtn.disabled = false;
      hideError(elements);
    };
    img.onerror = () => {
      showError('Failed to load image. Please try a different file.', elements);
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    showError('Failed to read file. Please try again.', elements);
  };
  reader.readAsDataURL(file);
}

// Preprocess image to improve OCR accuracy
// Applies: grayscale, contrast enhancement, adaptive thresholding
function preprocessImage(imageSource) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Resize to reasonable dimensions
      const maxDim = 2000;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Simple preprocessing: grayscale + adaptive threshold
      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // Compute Otsu's threshold
      const hist = new Array(256).fill(0);
      const pixelCount = width * height;
      for (let i = 0; i < data.length; i += 4) {
        hist[Math.round(data[i])]++;
      }

      const total = pixelCount;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * hist[i];

      let maxVariance = 0;
      let threshold = 128;
      let sumB = 0, weightB = 0, weightF = 0;

      for (let t = 0; t < 256; t++) {
        weightB += hist[t];
        if (weightB === 0) continue;
        weightF = total - weightB;
        if (weightF === 0) break;
        sumB += t * hist[t];
        const meanB = sumB / weightB;
        const meanF = (sum - sumB) / weightF;
        const variance = weightB * weightF * Math.pow(meanB - meanF, 2);
        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = t;
        }
      }

      // Apply threshold
      for (let i = 0; i < data.length; i += 4) {
        const binary = data[i] < threshold ? 0 : 255;
        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(imageSource);
    img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  });
}

function resizeImageDataUrl(dataUrl, maxDimension) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl); // Fallback to original
    img.src = dataUrl;
  });
}

function resetUpload(elements) {
  elements.fileInput.value = '';
  elements.preview.src = '';
  elements.previewContainer.classList.add('hidden');
  elements.uploadZone.classList.remove('hidden');
  elements.processBtn.disabled = true;
  elements.resultsSection.classList.add('hidden');
  elements.progressSection.classList.add('hidden');
  elements.progressBar.style.width = '0%';

  // Clean up blob URL
  if (elements._blobUrl) {
    URL.revokeObjectURL(elements._blobUrl);
    elements._blobUrl = null;
  }
  elements._currentFile = null;

  hideError(elements);
}

function updateProgress(percent, status, elements) {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressText.textContent = status;
}

async function processImage(elements) {
  showError(null, elements);
  elements.resultsSection.classList.add('hidden');
  elements.progressSection.classList.remove('hidden');
  updateProgress(0, 'Preparing image...', elements);

  try {
    // Get the image data to process
    let imageSource;

    // Use blob URL (most reliable for Tesseract)
    if (elements._blobUrl) {
      console.log('Using blob URL for OCR:', elements._blobUrl);
      imageSource = elements._blobUrl;
    } else if (elements._currentFile) {
      console.log('Using File object for OCR:', elements._currentFile.name);
      imageSource = elements._currentFile;
    } else if (elements.preview.src) {
      console.log('Using preview data URL as fallback');
      imageSource = elements.preview.src;
    } else {
      throw new Error('No image available for OCR processing');
    }

    // Preprocess image to improve OCR quality
    updateProgress(10, 'Preprocessing image for better OCR...', elements);
    const preprocessedImage = await preprocessImage(imageSource);
    console.log('Preprocessing complete');

    // Perform OCR
    updateProgress(20, 'Starting OCR...', elements);
    console.log('Starting OCR with Tesseract...');
    const text = await performOCR(preprocessedImage, elements);
    console.log('OCR completed. Text length:', text?.length || 0);

    if (!text || text.trim().length === 0) {
      showError('No text found in the image. Try a clearer image with better contrast.', elements);
      elements.progressSection.classList.add('hidden');
      return;
    }

    // Display extracted text
    elements.extractedText.textContent = text;

    // Extract phone numbers and fields
    updateProgress(90, 'Extracting data...', elements);
    const phoneNumbers = extractPhoneNumbers(text);
    const fields = extractFields(text);
    console.log('Phone numbers found:', phoneNumbers);
    console.log('Extracted fields:', fields);

    updateProgress(100, 'Processing complete', elements);

    // Render results after a brief delay
    setTimeout(() => {
      elements.progressSection.classList.add('hidden');
      renderResults(phoneNumbers, text, elements, fields);
    }, 500);

    // Cleanup preprocessed image blob if created
    if (preprocessedImage !== imageSource && preprocessedImage.startsWith('blob:')) {
      URL.revokeObjectURL(preprocessedImage);
    }

  } catch (error) {
    console.error('OCR Error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Provide more helpful error message
    let errorMsg = `OCR failed: ${error.message || 'Unknown error'}`;
    if (error.message?.includes('Network') || error.message?.includes('fetch')) {
      errorMsg = 'Network error: Could not load Tesseract language data. Please check your internet connection and try again.';
    } else if (error.message?.includes('CORS')) {
      errorMsg = 'CORS error: Unable to load image. Try a different image or check browser security settings.';
    } else if (error.message?.includes('Worker')) {
      errorMsg = 'Worker error: Tesseract worker failed to start. Try refreshing the page.';
    } else if (error.message?.includes('read image') || error.message?.includes('attempting to read')) {
      errorMsg = 'Unable to read image format. The image may be corrupted or in an unsupported format. Try converting to JPG or PNG and upload again.';
    }
    showError(`${errorMsg}. Please try again.`, elements);
    elements.progressSection.classList.add('hidden');
  }
}

async function performOCR(imageSource, elements) {
  console.log('Tesseract.recognize called with image source:', imageSource);

  // Use multiple languages: English + Traditional Chinese
  // Tesseract will automatically download the language data
  const lang = 'eng+chi_tra';

  return new Promise((resolve, reject) => {
    try {
      Tesseract.recognize(
        imageSource,
        lang,
        {
          logger: (m) => {
            console.log('Tesseract logger:', m);
            if (m.status === 'loading tesseract') {
              updateProgress(5, 'Loading OCR engine...', elements);
            } else if (m.status === 'initializing api') {
              updateProgress(15, 'Initializing...', elements);
            } else if (m.status === 'recognizing text') {
              const pct = Math.round(15 + (m.progress * 75));
              updateProgress(pct, `Recognizing text: ${Math.round(m.progress * 100)}%`, elements);
            } else if (m.status === 'done') {
              updateProgress(90, 'OCR complete, processing results...', elements);
            }
          }
        }
      ).then(({ data: { text } }) => {
        console.log('Tesseract result received, text length:', text?.length || 0);
        resolve(text);
      }).catch(err => {
        console.error('Tesseract promise rejected:', err);
        reject(err);
      });
    } catch (err) {
      console.error('Exception in performOCR:', err);
      reject(err);
    }
  });
}

function extractPhoneNumbers(text) {
  // Multiple regex patterns for different phone number formats
  const patterns = [
    // E.164 international format: +[country code][number]
    /\+?1?[1-9]\d{1,14}/g,
    // US/Canada: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // Generic: sequences of digits, possibly with separators (7-15 digits after cleaning)
    /[\d\s\-]{7,20}/g
  ];

  const rawNumbers = new Set();

  // Collect all matches from all patterns
  const debugMatches = [];
  patterns.forEach((pattern, pIndex) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.trim();
        if (cleaned.length >= 7) { // Keep longer candidates (min 7 chars)
          rawNumbers.add(cleaned);
          debugMatches.push({ pattern: pIndex + 1, raw: cleaned });
        }
      });
    }
  });

  console.log('Raw phone candidates before normalization:', debugMatches);

  // Normalize and filter with stricter validation
  const normalized = [];
  rawNumbers.forEach(num => {
    const clean = normalizePhoneNumber(num);
    if (clean) {
      normalized.push(clean);
      console.log('Normalized phone: "' + num + '" -> "' + clean + '"');
    } else {
      console.log('Rejected phone candidate:', num);
    }
  });

  // Deduplicate after normalization
  const finalPhones = [...new Set(normalized)];
  console.log('Final phone numbers after deduplication:', finalPhones);
  return finalPhones;
}

function extractFields(text) {
  const fields = {
    itemId: null,
    dateOfCheckIn: null,
    pickupNumber: null
  };

  // Extract ItemID: HK followed by alphanumeric characters
  // Matches: HK01344302487, HKaBc123 etc.
  const itemIdMatch = text.match(/HK([A-Z0-9]+)/);
  if (itemIdMatch) {
    fields.itemId = 'HK' + itemIdMatch[1];
  }

  // Extract DateOfCheckIn: DD-MM-YYYY format, located next to "入庫"
  // Matches: 入庫19-01-2026 or 入庫 19-01-2026 (with spaces)
  const dateMatch = text.match(/入庫 *(\d{2}-\d{2}-\d{4})/);
  if (dateMatch) {
    fields.dateOfCheckIn = dateMatch[1];
  }

  // Extract PickupNumber: pattern X-X-XXXX
  // Strategy: Try multiple patterns in order of reliability

  // 1. With keywords: "已入庫" or "已簽收"
  let pickupMatch = text.match(/(?:已入庫|已簽收) *(\d{1}-\d{1}-\d{4})/);
  if (pickupMatch) {
    fields.pickupNumber = pickupMatch[1];
    return fields;
  }

  // 2. Look for standalone pattern on its own line (common in package slips)
  // Split into lines and find line that is exactly X-X-XXXX
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    const trimmed = line.trim();
    if (/^\d{1}-\d{1}-\d{4}$/.test(trimmed)) {
      fields.pickupNumber = trimmed;
      return fields;
    }
  }

  // 3. Look for pattern after "包裹詳情" or similar header
  pickupMatch = text.match(/包裹詳情[^\n\r]*[\r\n]+\s*(\d{1}-\d{1}-\d{4})/);
  if (pickupMatch) {
    fields.pickupNumber = pickupMatch[1];
    return fields;
  }

  // 4. Last resort: find any X-X-XXXX pattern (may have false positives)
  pickupMatch = text.match(/(\d{1}-\d{1}-\d{4})/);
  if (pickupMatch) {
    fields.pickupNumber = pickupMatch[1];
  }

  return fields;
}

function normalizePhoneNumber(raw) {
  // Convert fullwidth digits (０-９) to ASCII digits first (common in Chinese OCR)
  let cleaned = raw.replace(/[０-９]/g, d => {
    const code = d.charCodeAt(0);
    return String.fromCharCode(code - 0xFEE0); // Convert fullwidth to ASCII
  });

  // Remove all non-digit characters except leading +
  let digits = cleaned.replace(/[^\d+]/g, '');

  // Remove Hong Kong country code (852) if present at the start
  // This handles both "852-xxxxx" and "852xxxxx" formats
  if (digits.startsWith('852')) {
    digits = digits.substring(3);
    console.log('Stripped HK country code 852 from:', cleaned, '-> remaining:', digits);
  }

  // Remove any leading + if present (keep pure digits for WhatsApp)
  digits = digits.replace(/^\+/, '');

  // Count actual digits
  const digitCount = digits.length;

  // Validate: 4-10 digits for local HK numbers, 7-15 for international
  if (digitCount < 4 || digitCount > 15) {
    return null;
  }

  // Additional check: if the number is all the same digit (likely not a phone)
  if (/^(\d)\1+$/.test(digits)) {
    return null; // e.g., "5555555" is suspicious
  }

  return digits;
}

function generateWhatsAppLink(phone, message) {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const encodedMessage = encodeURIComponent(message.trim());
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

function renderResults(phoneNumbers, fullText, elements, fields = null) {
  // Show results section
  elements.resultsSection.classList.remove('hidden');
  elements.phoneList.innerHTML = '';
  elements.phoneCount.textContent = phoneNumbers.length;

  // Display extracted fields if available
  if (fields) {
    const dataSection = document.getElementById('extractedData');
    dataSection.classList.remove('hidden');

    document.getElementById('fieldItemId').textContent = fields.itemId || '-';
    document.getElementById('fieldDate').textContent = fields.dateOfCheckIn || '-';
    document.getElementById('fieldPickup').textContent = fields.pickupNumber || '-';
  } else {
    document.getElementById('extractedData').classList.add('hidden');
  }

  if (phoneNumbers.length === 0) {
    elements.noResults.classList.remove('hidden');
    return;
  }

  elements.noResults.classList.add('hidden');

  // Debug: Show raw phone candidates (hidden by default, can be expanded)
  // This helps diagnose extraction issues
  if (window.DEBUG || true) { // set window.DEBUG = true to force show
    const debugExists = document.getElementById('phoneDebug');
    if (!debugExists) {
      const debugDetails = document.createElement('details');
      debugDetails.id = 'phoneDebug';
      debugDetails.className = 'extracted-text-section';
      debugDetails.innerHTML = '<summary>Debug: Raw Phone Candidates (from OCR)</summary><pre id="debugPhoneList" style="padding: 10px; font-size: 0.8rem; color: #666;"></pre>';
      elements.resultsSection.insertBefore(debugDetails, elements.resultsSection.firstChild);
    }
    document.getElementById('debugPhoneList').textContent = JSON.stringify({
      extractedTextLength: fullText.length,
      phoneNumbers: phoneNumbers,
      fields: fields
    }, null, 2);
  }

  // Create phone number cards
  phoneNumbers.forEach(phone => {
    const card = document.createElement('div');
    card.className = 'phone-card';

    // Format phone number for display (add formatting)
    const displayPhone = formatPhoneNumber(phone);
    const numberSpan = document.createElement('div');
    numberSpan.className = 'phone-number';
    numberSpan.textContent = displayPhone;
    card.appendChild(numberSpan);

    // Action buttons container
    const actions = document.createElement('div');
    actions.className = 'phone-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-copy';
    copyBtn.innerHTML = '<span class="icon icon-copy"></span> Copy';
    copyBtn.onclick = () => copyToClipboard(phone, copyBtn);
    actions.appendChild(copyBtn);

    // WhatsApp button
    const waBtn = document.createElement('button');
    waBtn.className = 'btn btn-whatsapp';
    waBtn.innerHTML = '<span class="icon icon-whatsapp"></span> WhatsApp';
    waBtn.onclick = () => {
      let message = elements.messageTemplate.value;
      // Replace placeholders with extracted values if available
      if (fields) {
        message = message
          .replace(/<Item ID>/g, fields.itemId || '')
          .replace(/<Check-in Date>/g, fields.dateOfCheckIn || '')
          .replace(/<Pickup Number>/g, fields.pickupNumber || '');
      }
      const url = generateWhatsAppLink(phone, message);
      // Check if popup might be blocked
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        showError('Popup blocked! Please allow popups for this site to open WhatsApp links.', elements);
        setTimeout(() => hideError(elements), 5000);
      }
    };
    actions.appendChild(waBtn);

    card.appendChild(actions);

    // Show WhatsApp URI for debugging/verification
    const message = elements.messageTemplate.value;
    const waUrl = generateWhatsAppLink(phone, message);
    const uriDiv = document.createElement('div');
    uriDiv.className = 'phone-uri';
    uriDiv.textContent = waUrl;
    uriDiv.title = 'WhatsApp link (click to copy)';
    uriDiv.onclick = () => copyToClipboard(waUrl, uriDiv);
    uriDiv.style.cursor = 'pointer';
    card.appendChild(uriDiv);
    elements.phoneList.appendChild(card);
  });

  // Add event listeners for field copy buttons
  document.querySelectorAll('.btn-copy-field').forEach(btn => {
    btn.onclick = () => {
      const field = btn.dataset.field;
      let valueToCopy = '';
      if (field === 'itemId' && fields?.itemId) valueToCopy = fields.itemId;
      if (field === 'date' && fields?.dateOfCheckIn) valueToCopy = fields.dateOfCheckIn;
      if (field === 'pickup' && fields?.pickupNumber) valueToCopy = fields.pickupNumber;

      if (valueToCopy) {
        copyToClipboard(valueToCopy, btn);
      } else {
        showError('No value available to copy', elements);
        setTimeout(() => hideError(elements), 2000);
      }
    };
  });
}

function formatPhoneNumber(phone) {
  // Add visual formatting for readability
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10 && !phone.includes('+')) {
    // US/Canada: (123) 456-7890
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1') && !phone.includes('+')) {
    // US with country code: 1-123-456-7890
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (phone.startsWith('+')) {
    // International: group digits
    return phone; // Return as-is but could add formatting
  }

  return phone;
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);

    // Visual feedback
    const originalText = button.innerHTML;
    button.innerHTML = '✓ Copied!';
    button.disabled = true;

    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
    }, 2000);

  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      const originalText = button.innerHTML;
      button.innerHTML = '✓ Copied!';
      button.disabled = true;
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
    } catch (fallbackErr) {
      showError('Failed to copy to clipboard. Please copy manually.', { error: document.getElementById('error') });
      setTimeout(() => hideError({ error: document.getElementById('error') }), 3000);
    }

    document.body.removeChild(textArea);
  }
}

function showError(message, elements) {
  if (!elements.error) {
    console.error(message || 'Unknown error');
    return;
  }

  elements.error.textContent = message;
  elements.error.classList.remove('hidden');
}

function hideError(elements) {
  if (elements.error) {
    elements.error.classList.add('hidden');
  }
}

// Utility: Escape HTML to prevent XSS in extracted text display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
