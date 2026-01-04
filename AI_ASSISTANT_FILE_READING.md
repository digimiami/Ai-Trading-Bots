# AI Assistant File Reading Enhancement

## Overview

The `/ai-assistant` endpoint has been enhanced to read and process attachments/files. The AI Assistant can now extract text content from various file types including text files, PDFs, code files, CSV files, and more.

## Features Added

### 1. **Multi-Format File Support**
   - **Text Files**: `.txt`, `.md`, `.log`, `.csv`, `.json`, `.xml`, `.html`, `.css`
   - **Code Files**: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.go`, `.rs`, `.rb`, `.php`, and more
   - **PDF Files**: Basic text extraction from PDF documents
   - **Images**: Detection and prompting for description (OCR not included)
   - **Office Documents**: Detection with guidance to convert to PDF/CSV

### 2. **Dual Input Methods**
   - **Base64 Data URLs**: Small files (<1MB) are sent as base64-encoded data
   - **Storage URLs**: Large files (>1MB) are automatically uploaded to Supabase Storage and URLs are sent instead

### 3. **Smart Content Extraction**
   - Automatically detects file type from extension and MIME type
   - Extracts readable text content from supported formats
   - Handles encoding issues (UTF-8, Latin-1 fallback)
   - Limits content length to prevent token overflow (5000 chars per file)

## Implementation Details

### Backend (`supabase/functions/ai-assistant/index.ts`)

#### New Functions:
- `extractTextFromFile()`: Main function that processes files based on type
- `extractTextFromPDF()`: Basic PDF text extraction using pattern matching

#### Enhanced Attachment Processing:
```typescript
// Supports both URL and base64 data
if (att.url) {
  // Fetch file from Supabase Storage
} else if (att.data) {
  // Decode base64 data
}
```

### Frontend (`src/pages/ai-assistant/page.tsx`)

#### Enhanced File Handling:
- Files <1MB: Sent as base64 data URLs
- Files >1MB: Uploaded to `message-attachments` storage bucket, URL sent instead
- Automatic fallback to base64 if storage upload fails

## Usage

### For Users:
1. **Attach Files**: Click the attachment button and select files
2. **Send Message**: Files are automatically processed and sent with your message
3. **AI Analysis**: The AI Assistant reads file contents and can answer questions about them

### Supported File Types:

#### Fully Supported (Text Extraction):
- Text files (`.txt`, `.md`, `.log`)
- CSV files (`.csv`)
- Code files (`.js`, `.ts`, `.py`, `.java`, etc.)
- JSON files (`.json`)
- XML/HTML files (`.xml`, `.html`, `.css`)
- Configuration files (`.sh`, `.bat`, `.ps1`, `.sql`)

#### Partially Supported:
- **PDFs**: Basic text extraction (may miss complex formatting)
- **Images**: Detection only (user must describe contents)

#### Not Supported (Guidance Provided):
- Word documents (`.docx`) - Convert to PDF
- Excel spreadsheets (`.xlsx`, `.xls`) - Export as CSV
- Other binary formats

## File Size Limits

- **Small Files (<1MB)**: Sent as base64 (fast, no storage needed)
- **Large Files (>1MB)**: Uploaded to storage (efficient, avoids token limits)

## Storage Setup

The feature uses the existing `message-attachments` storage bucket. If you need a dedicated bucket:

1. Go to Supabase Dashboard → Storage
2. Create bucket: `ai-assistant-attachments`
3. Set to Public
4. Update the frontend code to use the new bucket name

## Example Use Cases

1. **Code Review**: Upload code files and ask the AI to review or explain them
2. **Data Analysis**: Upload CSV files and ask questions about the data
3. **Document Analysis**: Upload text/PDF files and ask questions about content
4. **Configuration Help**: Upload config files and ask for explanations or optimizations

## Limitations

1. **PDF Extraction**: Basic pattern matching - may miss complex PDFs with images or special formatting
2. **Image OCR**: Not included - users must describe image contents
3. **Office Documents**: Not parsed - users should convert to PDF/CSV
4. **File Size**: Very large files may still hit token limits (content truncated to 5000 chars)
5. **Encoding**: Some files with unusual encodings may not extract correctly

## Future Enhancements

Potential improvements:
- Full PDF parsing library integration
- Image OCR using external services
- Office document parsing (Word, Excel)
- Better encoding detection
- Chunking for very large files
- Support for more file types

## Testing

To test the feature:
1. Go to `/ai-assistant` page
2. Attach a text file (`.txt`, `.md`, `.csv`, etc.)
3. Ask a question about the file contents
4. The AI should read and respond based on the file content

Example:
- Upload `trading-strategy.txt`
- Ask: "What does this strategy recommend?"
- AI reads the file and answers based on its contents


