/**
 * Site to Site File Transfer Node
 * 
 * Main node class for the n8n Site to Site File Transfer node.
 * This node enables streaming file transfers between URLs without loading entire files into memory,
 * making it ideal for transferring large files (GB+) without causing memory exhaustion.
 * 
 * Key Features:
 * - Uses Node.js native HTTP/HTTPS for downloads to ensure true streaming
 * - Pipes download stream directly to upload without intermediate buffering
 * - Constant memory usage regardless of file size
 * - Supports bearer token authentication (from URL query string or headers)
 * - Configurable HTTP methods (POST/PUT) and custom headers
 * 
 * @module SiteToSiteFileTransfer
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { operations } from './actions';

export class SiteToSiteFileTransfer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Site to Site File Transfer',
		name: 'siteToSiteFileTransfer',
		icon: 'file:transfer.svg',
		group: ['transform'],
		version: 1,
		description: 'Stream files from a download URL directly to an upload URL without loading into memory',
		defaults: {
			name: 'Site to Site File Transfer',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			// Add operation-specific properties dynamically
			...operations.transferFile.description,
		],
	};

	/**
	 * Execute the node operation
	 * 
	 * Processes each input item and transfers files from download URL to upload URL.
	 * Handles errors according to the node's error handling configuration.
	 * 
	 * @param this - n8n execution context
	 * @returns Array of execution results, one per input item
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Process each input item sequentially
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Execute the file transfer operation
				const result = await operations.transferFile.execute.call(this, itemIndex);
				returnData.push(result);
			} catch (error) {
				// Handle errors based on node configuration
				if (this.continueOnFail()) {
					// Continue processing remaining items even if this one fails
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				// Re-throw error to stop execution
				if (error instanceof Error) {
					throw error;
				}
				throw new Error(String(error));
			}
		}

		return [returnData];
	}
}

export default SiteToSiteFileTransfer;