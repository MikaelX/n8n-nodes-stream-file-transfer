# n8n-nodes-site-to-site-file-transfer

An n8n community node for streaming file transfers between URLs without loading entire files into memory. This node efficiently transfers files from a download URL directly to an upload URL using Node.js streams, making it ideal for large file transfers and memory-constrained environments.

## Features

- **Memory Efficient**: Streams files directly without loading entire files into memory
- **Large File Support**: Handles files of any size with constant memory usage
- **Flexible Authentication**: Supports bearer tokens in URL query strings or custom headers
- **Configurable**: Supports both POST and PUT methods, custom headers, and error handling
- **Automatic Content-Type Handling**: Prevents JSON parsing of binary responses
- **Buffer Support**: Automatically converts Buffer responses to streams when needed
- **TypeScript**: Full type safety and modern JavaScript features

## Installation

### Install from npm (Recommended)

```bash
npm install n8n-nodes-site-to-site-file-transfer
# or
yarn add n8n-nodes-site-to-site-file-transfer
```

After installation, restart your n8n instance. The node will be automatically available.

### Install from Local Path

```bash
# Build the node first
cd /path/to/n8n-nodes-site2site-transfer
yarn build

# Install from local path
npm install /path/to/n8n-nodes-site2site-transfer
# or
yarn add /path/to/n8n-nodes-site2site-transfer

# Restart n8n
```

### Development Mode

For local development and testing:

```bash
# Clone the repository
git clone git@github.com:MikaelX/n8n-nodes-site-to-site-file-transfer.git
cd n8n-nodes-site-to-site-file-transfer

# Install dependencies
yarn install

# Build
yarn build

# Development mode (watch for changes)
yarn build:watch
```

## Quick Start

1. **Install the package** (see Installation above)
2. **Add the Node:**
   - Create a new workflow in n8n
   - Add the **Site to Site File Transfer** node
   - Configure the download and upload URLs
   - Execute the workflow

## Usage

### Basic Transfer

1. Add the "Site to Site File Transfer" node to your workflow
2. Configure:
   - **Download URL**: The URL to download the file from (e.g., Google Cloud Storage signed URL)
   - **Upload URL**: The URL to upload the file to (e.g., your API endpoint)
3. Execute the workflow

The node will automatically:
- Stream the file from the download URL
- Transfer it directly to the upload URL
- Handle authentication headers
- Detect content length from response headers

### Advanced Configuration

#### Content Length
- **Optional**: File size in bytes
- If not provided, will be auto-detected from download response headers
- Can be manually specified for better control

#### HTTP Method
- **POST** (default): Standard HTTP POST request
- **PUT**: HTTP PUT request for RESTful APIs

#### Download Headers
JSON object with custom headers for the download request. Example:
```json
{
  "Authorization": "Bearer token123",
  "Custom-Header": "value"
}
```

#### Upload Headers
JSON object with custom headers for the upload request. Example:
```json
{
  "X-Custom-Header": "value",
  "Content-Type": "application/pdf"
}
```

**Note**: `Content-Type` defaults to `application/octet-stream` but can be overridden.

#### Throw Error on Non-2xx Status Codes
- **Enabled** (default): Node will throw an error and fail execution on 3xx, 4xx, or 5xx status codes
- **Disabled**: Node will return error information in the output instead of throwing

### Bearer Token Support

The node automatically extracts bearer tokens from upload URLs and adds them to the `Authorization` header.

**Example URL with bearer token:**
```
https://api.example.com/upload?bearer=eyJhbGciOiJIUzI1NiJ9...
```

The token will be:
- Extracted from the `bearer` query parameter
- Added to the `Authorization` header as `Bearer <token>`
- Kept in the URL query string (for APIs that require it there)

**Alternative**: Provide the bearer token directly in Upload Headers:
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9..."
}
```

## How It Works

The node uses Node.js streams to efficiently transfer files:

1. **Download Request**: Makes a GET request to the download URL with `Accept: */*` header to prevent automatic JSON parsing
2. **Stream Processing**: Receives the response as a stream (or converts Buffer to stream if needed)
3. **Upload Request**: Pipes the download stream directly to the upload URL
4. **Memory Efficient**: Files are never fully loaded into memory, only small chunks are buffered

### Technical Details

- Uses n8n's `helpers.request()` for download with `encoding: null` to get binary streams
- Automatically handles Buffer responses by converting them to streams using `Readable.from()`
- Sets `Accept: */*` header to prevent automatic JSON parsing of binary responses
- Provides detailed error messages when responses can't be streamed

## Output

The node returns a JSON object with the following fields:

- `success`: Boolean indicating transfer success
- `downloadStatus`: HTTP status code from download response (e.g., 200)
- `uploadStatus`: HTTP status code from upload response (e.g., 200, 201)
- `uploadResponse`: Response data from upload endpoint (if available)

**Example Output:**
```json
{
  "success": true,
  "downloadStatus": 200,
  "uploadStatus": 200,
  "uploadResponse": {
    "id": "file-123",
    "status": "uploaded"
  }
}
```

## Examples

### Example 1: Basic File Transfer

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload",
  "method": "POST"
}
```

### Example 2: Transfer with Bearer Token in URL

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload?bearer=eyJhbGciOiJIUzI1NiJ9...",
  "method": "POST"
}
```

### Example 3: Transfer with Custom Headers

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload",
  "method": "PUT",
  "downloadHeaders": "{\"Authorization\": \"Bearer download-token\"}",
  "uploadHeaders": "{\"X-Custom-Header\": \"value\"}",
  "contentLength": 1048576
}
```

### Example 4: Error Handling (Non-Throwing)

```json
{
  "downloadUrl": "https://storage.googleapis.com/bucket/file.pdf",
  "uploadUrl": "https://api.example.com/files/upload",
  "throwOnError": false
}
```

When `throwOnError` is false, errors are returned in the output instead of throwing:
```json
{
  "success": false,
  "error": "Upload failed with HTTP 401...",
  "uploadStatus": 401,
  "downloadStatus": 200
}
```

## Common Use Cases

### Google Cloud Storage to API
Transfer files from Google Cloud Storage signed URLs to your API endpoint.

### S3 to Another Service
Stream files from AWS S3 to another cloud storage or API.

### Large File Transfers
Transfer large files (GB+) without memory issues.

### Automated File Processing
Part of a workflow that processes files between different services.

## Troubleshooting

### "Download response is not a streamable format"

This error occurs when the download URL returns JSON/text instead of binary data. The node automatically sets `Accept: */*` to prevent this, but some servers may still return JSON.

**Solutions:**
- Verify the download URL returns binary data
- Check if the URL requires specific headers
- Ensure the URL is a direct file download link (not a redirect to a JSON response)

### "Upload failed with HTTP 401"

Authentication error. Check:
- Bearer token in URL or headers is valid
- Token hasn't expired
- Upload endpoint accepts the authentication method

### "Download failed with HTTP 404"

The download URL is not accessible. Verify:
- URL is correct and accessible
- File exists at the specified location
- Required authentication headers are provided

## Project Structure

```
n8n-nodes-site-to-site-file-transfer/
├── src/
│   └── nodes/
│       └── SiteToSiteFileTransfer/
│           ├── SiteToSiteFileTransfer.node.ts    # Main node implementation
│           ├── SiteToSiteFileTransfer.node.json  # Node metadata
│           ├── GenericFunctions.ts                # Shared utility functions
│           ├── transfer.svg                       # Node icon (azure blue dual globe)
│           └── actions/                           # Operation implementations
│               ├── index.ts                      # Operation registry
│               └── transferFile.operation.ts      # File transfer operation
├── dist/                                          # Compiled output
├── scripts/
│   └── fix-node-exports.js                       # Build script (includes SVG copy)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Prerequisites

- Node.js (v20 or higher)
- Yarn (v1.22.0 or higher)

### Setup

```bash
# Clone the repository
git clone git@github.com:MikaelX/n8n-nodes-site-to-site-file-transfer.git
cd n8n-nodes-site-to-site-file-transfer

# Install dependencies
yarn install
```

### Development Commands

```bash
# Build for production
yarn build

# Build in watch mode
yarn build:watch

# Run linter
yarn lint
yarn lint:fix

# Type check
yarn typecheck

# Run tests
yarn test
yarn test:watch
yarn test:coverage

# Create release
yarn release
```

### Testing

The project includes comprehensive tests:

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:coverage
```

## License

MIT License - see LICENSE file for details.

## Support

For issues, feature requests, or questions:
- Open an issue on [GitHub](https://github.com/MikaelX/n8n-nodes-site-to-site-file-transfer/issues)
- Check the [n8n Community Forum](https://community.n8n.io/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
