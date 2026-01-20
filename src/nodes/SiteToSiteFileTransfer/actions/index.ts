/**
 * Actions Index
 * 
 * Exports all available operations/actions for the Site to Site File Transfer node.
 * Currently contains a single operation: transferFile
 * 
 * This module serves as the central registry for all node operations,
 * making it easy to add additional operations in the future if needed.
 * 
 * @module actions/index
 */

import type { IExecuteFunctions, INodeProperties, INodeExecutionData } from 'n8n-workflow';
import * as transferFile from './transferFile.operation';

/**
 * Registry of all available operations
 * 
 * Each operation provides:
 * - description: Array of INodeProperties defining the operation's parameters
 * - execute: Function that performs the operation
 */
export const operations: Record<
	string,
	{
		description: INodeProperties[];
		execute: (this: IExecuteFunctions, itemIndex: number) => Promise<INodeExecutionData>;
	}
> = {
	transferFile: {
		description: transferFile.description,
		execute: transferFile.execute,
	},
};
