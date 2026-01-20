/**
 * Transfer File Operation
 * 
 * Core operation for streaming file transfers between URLs.
 * 
 * This operation implements the main file transfer logic:
 * 1. Downloads file from source URL using Node.js native HTTP/HTTPS (ensures true streaming)
 * 2. Streams the download directly to upload URL without buffering
 * 3. Handles authentication, headers, and error cases
 * 
 * Key Implementation Details:
 * - Uses native Node.js http/https modules for downloads (not n8n's helpers.request)
 *   because n8n's helper may buffer responses even with encoding: null/stream
 * - Native HTTP always returns streams, guaranteeing no buffering
 * - Upload uses n8n's helpers.request() which correctly handles stream bodies
 * - No fallback to buffering - fails fast if streaming is not possible
 * 
 * Memory Efficiency:
 * - Constant memory usage regardless of file size (typically < 50MB even for GB+ files)
 * - Streams are piped directly: download -> upload with minimal buffering
 * - Only network buffers and stream internal buffers consume memory
 * 
 * @module transferFile.operation
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	IRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { extractBearerToken, parseHeaders } from '../GenericFunctions';
import { URL } from 'url';
import * as http from 'http';
import * as https from 'https';

/**
 * Node property definitions for the transfer file operation
 * 
 * Defines all user-configurable parameters for the file transfer node,
 * including URLs, headers, HTTP method, and error handling options.
 */
export const description: INodeProperties[] = [
	{
		displayName: 'Download URL',
		name: 'downloadUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'URL to download the file from',
		placeholder: 'https://example.com/file.zip',
	},
	{
		displayName: 'Upload URL',
		name: 'uploadUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'URL to upload the file to',
		placeholder: 'https://upload.example.com/upload',
	},
	{
		displayName: 'Content Length',
		name: 'contentLength',
		type: 'number',
		default: '',
		required: false,
		description: 'File size in bytes (optional, will be detected from download response if not provided)',
	},
	{
		displayName: 'HTTP Method',
		name: 'method',
		type: 'options',
		options: [
			{
				name: 'POST',
				value: 'POST',
			},
			{
				name: 'PUT',
				value: 'PUT',
			},
		],
		default: 'POST',
		description: 'HTTP method to use for upload',
	},
	{
		displayName: 'Download Headers',
		name: 'downloadHeaders',
		type: 'json',
		default: '{}',
		required: false,
		description: 'Additional headers for the download request (JSON object)',
	},
	{
		displayName: 'Upload Headers',
		name: 'uploadHeaders',
		type: 'json',
		default: '{}',
		required: false,
		description: 'Additional headers for the upload request (JSON object). Bearer tokens in upload URL query string are automatically extracted.',
	},
	{
		displayName: 'Throw Error on Non-2xx Status Codes',
		name: 'throwOnError',
		type: 'boolean',
		default: true,
		description: 'Whether to throw an error and fail execution when the API returns a 3xx, 4xx, or 5xx status code',
	},
];

/**
 * Execute the file transfer operation
 * 
 * Performs a streaming file transfer from download URL to upload URL.
 * The transfer uses true streaming - files are never fully loaded into memory.
 * 
 * Process:
 * 1. Validates input parameters (URLs, headers, etc.)
 * 2. Prepares download headers (ensures Accept header set to prevent JSON parsing)
 * 3. Prepares upload headers (includes Content-Type, bearer token, Content-Length)
 * 4. Downloads file using native HTTP/HTTPS (streaming)
 * 5. Pipes download stream directly to upload (no buffering)
 * 6. Returns success/error result
 * 
 * @param this - n8n execution context
 * @param itemIndex - Index of the current item being processed
 * @returns Execution result with transfer status and response data
 * @throws Error if transfer fails and throwOnError is true
 */
export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	// Get parameters from node configuration
	const downloadUrl = this.getNodeParameter('downloadUrl', itemIndex) as string;
	const uploadUrl = this.getNodeParameter('uploadUrl', itemIndex) as string;
	const contentLength = this.getNodeParameter('contentLength', itemIndex, '') as
		| string
		| number;
	const method = (this.getNodeParameter('method', itemIndex, 'POST') as string) as 'POST' | 'PUT';
	const downloadHeadersParam = this.getNodeParameter('downloadHeaders', itemIndex, '{}') as
		| string
		| IDataObject;
	const uploadHeadersParam = this.getNodeParameter('uploadHeaders', itemIndex, '{}') as
		| string
		| IDataObject;
	const throwOnError = this.getNodeParameter('throwOnError', itemIndex, true) as boolean;

	// Validate required parameters
	if (!downloadUrl || downloadUrl.trim() === '') {
		throw new Error('Download URL is required and cannot be empty');
	}

	if (!uploadUrl || uploadUrl.trim() === '') {
		throw new Error('Upload URL is required and cannot be empty');
	}

	// Parse headers from JSON strings or objects
	const downloadHeaders = parseHeaders(downloadHeadersParam);
	const uploadHeaders = parseHeaders(uploadHeadersParam);

	// Ensure Accept header is set to prevent automatic JSON parsing
	// This forces the response to be treated as binary/stream, not parsed as JSON
	const finalDownloadHeaders: Record<string, string> = {
		Accept: '*/*',
		...downloadHeaders,
	};

	// Extract bearer token from upload URL query string if present
	// Some APIs require tokens in URL: https://api.example.com/upload?bearer=token
	const { token } = extractBearerToken(uploadUrl);

	// Prepare upload headers with defaults
	const finalUploadHeaders: Record<string, string> = {
		'Content-Type': 'application/octet-stream',
		...uploadHeaders,
	};

	// Add bearer token to Authorization header if extracted from URL and not already present
	if (token && !finalUploadHeaders['Authorization'] && !finalUploadHeaders['authorization']) {
		finalUploadHeaders['Authorization'] = `Bearer ${token}`;
	}

	// Add Content-Length header if provided (helps some APIs optimize)
	if (contentLength) {
		const length = typeof contentLength === 'number' ? contentLength : parseInt(contentLength, 10);
		if (!isNaN(length) && length > 0) {
			finalUploadHeaders['Content-Length'] = String(length);
		}
	}

	try {
		// ====================================================================
		// STEP 1: Download file using native HTTP/HTTPS (ensures true streaming)
		// ====================================================================
		// We use Node.js native http/https modules instead of n8n's helpers.request()
		// because n8n's helper may buffer responses even with encoding: null/stream.
		// Native HTTP always returns streams, guaranteeing no buffering.
		
		const downloadUrlObj = new URL(downloadUrl);
		const downloadClient = downloadUrlObj.protocol === 'https:' ? https : http;
		
		// Create download request using native HTTP client
		const downloadStream = await new Promise<{ stream: NodeJS.ReadableStream; statusCode: number; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
			const downloadOptions = {
				hostname: downloadUrlObj.hostname,
				port: downloadUrlObj.port || (downloadUrlObj.protocol === 'https:' ? 443 : 80),
				path: downloadUrlObj.pathname + downloadUrlObj.search,
				method: 'GET',
				headers: finalDownloadHeaders,
			};

			// Create the HTTP request
			const req = downloadClient.request(downloadOptions, (res) => {
				const statusCode = res.statusCode || 0;
				
				// Validate download response status
				if (statusCode < 200 || statusCode >= 300) {
					res.destroy(); // Clean up failed response
					const errorMessage = `Download failed with HTTP ${statusCode} from ${downloadUrl}. Please verify the download URL is accessible and returns a successful response.`;
					reject(new Error(errorMessage));
					return;
				}

				// Extract Content-Length from response headers if not already provided
				// This helps optimize the upload request
				const actualContentLength = contentLength || res.headers['content-length'];
				if (actualContentLength && !finalUploadHeaders['Content-Length']) {
					const length =
						typeof actualContentLength === 'number'
							? actualContentLength
							: parseInt(actualContentLength, 10);
					if (!isNaN(length) && length > 0) {
						finalUploadHeaders['Content-Length'] = String(length);
					}
				}

				// Return the response stream - this is a true Node.js ReadableStream
				// Native HTTP always returns streams, never buffers
				resolve({
					stream: res,
					statusCode,
					headers: res.headers,
				});
			});

			// Handle request errors (network failures, DNS errors, etc.)
			req.on('error', (error) => {
				reject(new Error(`Download request failed: ${error.message}`));
			});

			// Send the request
			req.end();
		});

		const downloadStatusCode = downloadStream.statusCode;
		// downloadStream.stream is guaranteed to be a Node.js ReadableStream from native HTTP
		// No need to check for Buffer or object - native HTTP always returns streams

		// ====================================================================
		// STEP 2: Upload file by piping download stream directly to upload
		// ====================================================================
		// The download stream is piped directly to the upload request body.
		// This ensures true streaming - data flows chunk-by-chunk without
		// loading the entire file into memory.
		// 
		// We use n8n's helpers.request() for upload because it correctly
		// handles stream bodies and provides good integration with n8n's
		// error handling and response parsing.
		
		const uploadOptions: IRequestOptions = {
			method,
			url: uploadUrl,
			headers: finalUploadHeaders,
			body: downloadStream.stream, // Pipe native HTTP stream directly - guaranteed streaming
			resolveWithFullResponse: true,
		};

		const uploadResponse = await this.helpers.request(uploadOptions);

		// Validate upload response status
		const uploadStatusCode = uploadResponse.statusCode;
		
		if (uploadStatusCode !== undefined) {
			if (uploadStatusCode < 200 || uploadStatusCode >= 300) {
				// Upload failed - handle according to error handling configuration
				const errorMessage = `Upload failed with HTTP ${uploadStatusCode} to ${uploadUrl}. ` +
					`Please verify the upload URL is correct, authentication is valid, and the endpoint accepts ${method} requests.`;
				if (throwOnError) {
					throw new Error(errorMessage);
				}
				// Return error result instead of throwing
				return {
					json: {
						error: errorMessage,
						uploadStatus: uploadStatusCode,
						downloadStatus: downloadStatusCode,
						uploadUrl,
						downloadUrl,
					} as IDataObject,
					pairedItem: {
						item: itemIndex,
					},
				};
			}
		}

		// ====================================================================
		// STEP 3: Prepare success result
		// ====================================================================
		const result: IDataObject = {
			success: true,
			downloadStatus: downloadStatusCode || 200,
			uploadStatus: uploadStatusCode || 200,
		};

		// Include upload response body if available
		// helpers.request() with resolveWithFullResponse returns { statusCode, headers, body }
		if (uploadResponse.body !== undefined) {
			// Try to parse JSON response if possible, otherwise return as-is
			try {
				if (typeof uploadResponse.body === 'string') {
					result.uploadResponse = JSON.parse(uploadResponse.body);
				} else {
					result.uploadResponse = uploadResponse.body as IDataObject;
				}
			} catch {
				// Not valid JSON, return as-is
				result.uploadResponse = uploadResponse.body as IDataObject;
			}
		}

		return {
			json: result,
			pairedItem: {
				item: itemIndex,
			},
		};
	} catch (error) {
		// ====================================================================
		// ERROR HANDLING
		// ====================================================================
		// Catch any errors during download or upload and handle according to
		// the node's error handling configuration (throwOnError parameter)
		
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		// Enhance error message with context (URLs) if not already included
		const enhancedMessage = errorMessage.includes('Download URL') || errorMessage.includes('Upload URL')
			? errorMessage
			: `File transfer failed: ${errorMessage}. Download URL: ${downloadUrl}, Upload URL: ${uploadUrl}`;
		
		if (throwOnError) {
			// Throw error to stop workflow execution
			throw new Error(enhancedMessage);
		}
		
		// Return error result instead of throwing (allows workflow to continue)
		return {
			json: {
				error: enhancedMessage,
				success: false,
				downloadUrl,
				uploadUrl,
			} as IDataObject,
			pairedItem: {
				item: itemIndex,
			},
		};
	}
}
