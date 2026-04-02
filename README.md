# Photo to WhatsApp - OCR Phone Number Extractor

A lightweight, client-side web application that extracts phone numbers from photos using OCR (Optical Character Recognition) and generates WhatsApp chat links.

## Features

- **Upload Images**: Drag and drop or click to select image files (JPG, PNG, WebP, etc.)
- **OCR Text Extraction**: Uses Tesseract.js to extract all text from the image
- **Smart Phone Detection**: Extracts phone numbers in various formats (international, US/Canada, generic)
- **WhatsApp Integration**: One-click buttons to open WhatsApp with a prefilled message
- **Copy to Clipboard**: Quickly copy extracted phone numbers
- **Editable Message Template**: Customize the message sent via WhatsApp
- **Pure Client-Side**: No server, no data uploads - all processing in your browser
- **Privacy-Focused**: Your images never leave your device

## How to Use

1. **Open the app**: Simply open `index.html` in a modern web browser (Chrome, Firefox, Edge)
2. **Upload an image**: Drag and drop an image onto the upload zone, or click to browse
3. **Wait for OCR**: The app will process the image and show progress
4. **View results**:
   - See extracted text (click "View Extracted Text" to verify)
   - Review detected phone numbers
   - Edit your message template if needed
5. **Send WhatsApp**:
   - Click the **WhatsApp** button to open WhatsApp with your message and the phone number
   - Or click **Copy** to copy the number to your clipboard

## Supported Phone Number Formats

The app detects various phone number patterns:

- **International**: `+44 20 7946 0958`, `+33 1 23 45 67 89`, `+49-30-123456`
- **US/Canada**: `(555) 123-4567`, `555-123-4567`, `555.123.4567`, `5551234567`
- **With country code**: `1-555-123-4567`, `15551234567`
- **Generic**: Any sequence of 7-15 digits with spaces/dashes

The extracted numbers are normalized (cleaned of formatting) and deduplicated automatically.

## Browser Compatibility

Tested and working on:

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+ (some features like clipboard may require permissions)

**Note**: For best performance, use a modern browser with good WebGL support (Tesseract.js uses WebGL for acceleration).

## Privacy

All image processing happens **locally in your browser**. No image data is sent to any server. Tesseract.js loads language data from a CDN, but the actual OCR processing runs entirely on your device using WebAssembly/WebGL.

## Default Message Template

```
Hello, I'm interested in the item you posted. Could you provide more information?
```

You can customize this message in the text area. Your preference is saved in browser localStorage and will persist across sessions.

## WhatsApp Link Behavior

The app generates `wa.me` links that open WhatsApp with your message prefilled. You will still need to manually tap "Send" in WhatsApp. This approach:

- Requires no API keys or backend
- Works immediately with any WhatsApp account
- Opens in WhatsApp app (mobile) or WhatsApp Web (desktop)

**Important**: If your browser blocks popups, you may need to allow popups for this site to open WhatsApp links.

## Performance Tips

- **Image size**: Larger images take longer to process. The app automatically resizes images to max 2000px dimension for reasonable performance.
- **Image quality**: Clear, high-contrast text yields better OCR results. Blurry or low-light images may not extract text accurately.
- **Processing time**: Typical 1-5 seconds for standard photos on modern devices. The first load may be slower as Tesseract.js downloads the language data (~2-3 MB).

## File Structure

```
/
├── index.html      - Main application UI and structure
├── app.js          - Core logic: OCR, phone extraction, WhatsApp links
├── styles.css      - Responsive styling and components
└── README.md       - This file
```

## How It Works

1. **Image Upload**: User selects/drops an image file
2. **Preprocessing**: Image is resized (max 2000px) and compressed (0.8 quality JPEG) for optimal OCR speed
3. **OCR**: Tesseract.js processes the image and extracts raw text
4. **Phone Extraction**: Multiple regex patterns scan the text for phone numbers
5. **Normalization**: Numbers are cleaned (remove formatting), validated (7-15 digits), and deduplicated
6. **WhatsApp Link**: Each number gets a link: `https://wa.me/<phone>?text=<encoded_message>`
7. **Rendering**: Results displayed with copy and WhatsApp buttons

## Troubleshooting

**"No text found in the image"**
- Try a clearer image with better contrast
- Ensure the text is not blurry or heavily stylized
- Try cropping to focus on the text area

**"No phone numbers detected"**
- Verify the extracted text contains phone numbers (use "View Extracted Text")
- Phone numbers may be in a non-standard format not covered by regex patterns
- Check that numbers are not split across lines or have unusual separators

**OCR takes too long**
- Resize the image before uploading (smaller = faster)
- Close other tabs/apps to free up system resources
- First-time users: Tesseract language data (~3MB) downloads on first load

**WhatsApp doesn't open**
- Check if popup blocker is active; allow popups for this site
- Ensure WhatsApp is installed (mobile) or WhatsApp Web is accessible (desktop)
- Try copying the number manually and opening WhatsApp yourself

**Copy button doesn't work**
- Grant clipboard permission if prompted by browser
- Fallback: manually select and copy the displayed phone number

## Advanced: Adding More Languages

To add OCR support for other languages, modify `app.js`:

1. Change `Tesseract.recognize(imageElement, 'eng', ...)` to use different language codes (e.g., `'spa'`, `'fra'`, `'deu'`)
2. Tesseract will automatically download the corresponding language data from CDN
3. Multiple languages: use `'eng+spa'` for combined recognition

## License

This is a simple utility tool. Feel free to use, modify, and distribute as needed.

## Credits

- [Tesseract.js](https://github.com/naptha/tesseract.js) - OCR engine
- [WhatsApp](https://www.whatsapp.com/) - Click-to-chat feature

## Support

For issues, improvements, or questions, please refer to the project repository or documentation.

---

**Happy extracting! 📸 → 📱**
