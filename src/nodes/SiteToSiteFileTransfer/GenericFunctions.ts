/**
 * Generic Utility Functions
 * 
 * Shared utility functions used by the Site to Site File Transfer node.
 * Provides helper functions for parsing headers and extracting authentication tokens.
 * 
 * Functions:
 * - extractBearerToken: Extracts bearer tokens from URL query strings
 * - parseHeaders: Parses JSON header parameters into header objects
 * 
 * @module GenericFunctions
 */

import type { IDataObject } from 'n8n-workflow';
import { URL } from 'url';

/**
 * Extract bearer token from URL query string if present
 * 
 * Some APIs require bearer tokens in the URL query string (e.g., ?bearer=token).
 * This function extracts the token while preserving the original URL structure.
 * 
 * @param uploadUrl - The upload URL that may contain a bearer token in query string
 * @returns Object containing the extracted token (if found) and the original URL
 * @example
 * extractBearerToken('https://api.example.com/upload?bearer=abc123')
 * // Returns: { token: 'abc123', cleanUrl: 'https://api.example.com/upload?bearer=abc123' }
 */
export function extractBearerToken(uploadUrl: string): { token: string | null; cleanUrl: string } {
	try {
		const url = new URL(uploadUrl);
		const bearer = url.searchParams.get('bearer');
		if (bearer) {
			// Keep bearer in URL (some APIs require it in query string)
			// But also return it separately for potential header use
			return {
				token: bearer,
				cleanUrl: uploadUrl, // Keep original URL with bearer
			};
		}
	} catch (error) {
		// Invalid URL, return as-is
	}
	return { token: null, cleanUrl: uploadUrl };
}

/**
 * Parse JSON headers parameter
 * 
 * Converts header parameters (which can be JSON strings or objects) into
 * a standardized header object format. Handles both string JSON and object inputs.
 * 
 * @param headersParam - Headers as JSON string or object
 * @returns Record of header key-value pairs (all values converted to strings)
 * @example
 * parseHeaders('{"Authorization": "Bearer token", "Content-Type": "application/json"}')
 * // Returns: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }
 * 
 * parseHeaders({ Authorization: 'Bearer token' })
 * // Returns: { Authorization: 'Bearer token' }
 */
export function parseHeaders(headersParam: string | IDataObject): Record<string, string> {
	if (!headersParam) {
		return {};
	}

	if (typeof headersParam === 'string') {
		try {
			const parsed = JSON.parse(headersParam);
			if (typeof parsed === 'object' && parsed !== null) {
				const result: Record<string, string> = {};
				for (const [key, value] of Object.entries(parsed)) {
					if (typeof value === 'string' || typeof value === 'number') {
						result[key] = String(value);
					}
				}
				return result;
			}
		} catch (error) {
			// Invalid JSON, return empty
		}
		return {};
	}

	if (typeof headersParam === 'object' && headersParam !== null) {
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(headersParam)) {
			if (typeof value === 'string' || typeof value === 'number') {
				result[key] = String(value);
			}
		}
		return result;
	}

	return {};
}
