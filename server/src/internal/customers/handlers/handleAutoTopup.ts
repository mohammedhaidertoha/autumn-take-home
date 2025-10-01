import { ErrCode } from "@autumn/shared";
import { StatusCodes } from "http-status-codes";
import { routeHandler } from "@/utils/routerUtils.js";
import { CusProductService } from "../cusProducts/CusProductService.js";
import RecaseError from "@/utils/errorUtils.js";
import { ProductService } from "@/internal/products/ProductService.js";
import { CusService } from "../CusService.js";

/**
 * POST /customers/:customer_id/auto-topup
 * Configure auto-topup for a customer's product
 */
export const handleSetAutoTopup = async (req: any, res: any) =>
	routeHandler({
		req,
		res,
		action: "set auto-topup",
		handler: async () => {
			const { customer_id } = req.params;
			const { customer_product_id, threshold, topup_product_id } = req.body;
			const { db, org, env, logtail: logger } = req;

			// Validate inputs
			if (!customer_product_id || !threshold || !topup_product_id) {
				throw new RecaseError({
					message:
						"customer_product_id, threshold, and topup_product_id are required",
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.BAD_REQUEST,
				});
			}

			if (typeof threshold !== "number" || threshold < 0) {
				throw new RecaseError({
					message: "threshold must be a non-negative number",
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.BAD_REQUEST,
				});
			}

			// Verify the customer_product exists and belongs to this customer
			const cusProduct = await CusProductService.get({
				db,
				id: customer_product_id,
				orgId: org.id,
				env,
			});

			if (!cusProduct) {
				throw new RecaseError({
					message: `Customer product ${customer_product_id} not found`,
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.NOT_FOUND,
				});
			}

			if (cusProduct.customer_id !== customer_id) {
				throw new RecaseError({
					message: `Customer product ${customer_product_id} does not belong to customer ${customer_id}`,
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.BAD_REQUEST,
				});
			}

			// Verify the topup product exists
			const topupProduct = await ProductService.get({
				db,
				id: topup_product_id,
				orgId: org.id,
				env,
			});

			if (!topupProduct) {
				throw new RecaseError({
					message: `Topup product ${topup_product_id} not found`,
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.NOT_FOUND,
				});
			}

			// Update the customer_product with auto-topup settings
			await CusProductService.update({
				db,
				cusProductId: customer_product_id,
				updates: {
					auto_topup_threshold: threshold as any,
					auto_topup_product_id: topup_product_id as any,
				} as any,
			});

			logger.info(
				`Auto-topup configured for customer ${customer_id}, product ${customer_product_id}`,
			);

			res.status(200).json({
				success: true,
				message: "Auto-topup configured successfully",
				customer_id,
				customer_product_id,
				threshold,
				topup_product_id: topup_product_id,
			});
		},
	});

/**
 * GET /customers/:customer_id/auto-topup
 * Get auto-topup configurations for a customer
 */
export const handleGetAutoTopup = async (req: any, res: any) =>
	routeHandler({
		req,
		res,
		action: "get auto-topup",
		handler: async () => {
			const { customer_id } = req.params;
			const { db, org, env } = req;

			// Get customer to get internal_id
			const customer = await CusService.get({
				db,
				idOrInternalId: customer_id,
				orgId: org.id,
				env,
			});

			if (!customer) {
				throw new RecaseError({
					message: `Customer ${customer_id} not found`,
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.NOT_FOUND,
				});
			}

			// Get all customer products for this customer
			const cusProducts = await CusProductService.list({
				db,
				internalCustomerId: customer.internal_id,
			});

			// Filter to only those with auto-topup configured
			const autoTopupConfigs = cusProducts
				.filter((cp: any) => cp.auto_topup_threshold && cp.auto_topup_product_id)
				.map((cp: any) => ({
					customer_product_id: cp.id,
					product_id: cp.product_id,
					threshold: cp.auto_topup_threshold,
					topup_product_id: cp.auto_topup_product_id,
				}));

			res.status(200).json({
				customer_id,
				configs: autoTopupConfigs,
			});
		},
	});

/**
 * DELETE /customers/:customer_id/auto-topup/:customer_product_id
 * Disable auto-topup for a customer product
 */
export const handleDeleteAutoTopup = async (req: any, res: any) =>
	routeHandler({
		req,
		res,
		action: "delete auto-topup",
		handler: async () => {
			const { customer_id, customer_product_id } = req.params;
			const { db, org, env, logtail: logger } = req;

			// Verify the customer_product exists
			const cusProduct = await CusProductService.get({
				db,
				id: customer_product_id,
				orgId: org.id,
				env,
			});

			if (!cusProduct) {
				throw new RecaseError({
					message: `Customer product ${customer_product_id} not found`,
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.NOT_FOUND,
				});
			}

			if (cusProduct.customer_id !== customer_id) {
				throw new RecaseError({
					message: `Customer product ${customer_product_id} does not belong to customer ${customer_id}`,
					code: ErrCode.InvalidInputs,
					statusCode: StatusCodes.BAD_REQUEST,
				});
			}

			// Clear auto-topup settings
			await CusProductService.update({
				db,
				cusProductId: customer_product_id,
				updates: {
					auto_topup_threshold: null as any,
					auto_topup_product_id: null as any,
				} as any,
			});

			logger.info(
				`Auto-topup disabled for customer ${customer_id}, product ${customer_product_id}`,
			);

			res.status(200).json({
				success: true,
				message: "Auto-topup disabled successfully",
				customer_id,
				customer_product_id,
			});
		},
	});

