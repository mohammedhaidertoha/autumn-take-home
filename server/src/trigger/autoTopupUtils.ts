import { DrizzleCli } from "@/db/initDrizzle.js";
import {
	AppEnv,
	Organization,
	customerEntitlements,
	customerProducts,
	AttachBodySchema,
} from "@autumn/shared";
import { and, eq } from "drizzle-orm";
import { ProductService } from "@/internal/products/ProductService.js";
import { CusService } from "@/internal/customers/CusService.js";
import { getAttachParams } from "@/internal/customers/attach/attachUtils/attachParams/getAttachParams.js";
import { handleOneOffFunction } from "@/internal/customers/attach/attachFunctions/addProductFlow/handleOneOffFunction.js";

/**
 * Get total balance for a feature across all customer products
 */
export async function getTotalFeatureBalance({
	db,
	internalCustomerId,
	internalFeatureId,
}: {
	db: DrizzleCli;
	internalCustomerId: string;
	internalFeatureId: string;
}): Promise<number> {
	const cusEnts = await db
		.select({ balance: customerEntitlements.balance })
		.from(customerEntitlements)
		.where(
			and(
				eq(customerEntitlements.internal_customer_id, internalCustomerId),
				eq(customerEntitlements.internal_feature_id, internalFeatureId),
			),
		);

	return cusEnts.reduce((sum, ce) => sum + (ce.balance || 0), 0);
}

/**
 * Get all customer products with auto-topup configured
 */
export async function getAutoTopupConfigs({
	db,
	internalCustomerId,
}: {
	db: DrizzleCli;
	internalCustomerId: string;
}) {
	const cusProducts = await db
		.select()
		.from(customerProducts)
		.where(
			and(
				eq(customerProducts.internal_customer_id, internalCustomerId),
				// Only get products that have auto-topup configured
			),
		);

	return cusProducts.filter(
		(cp) => cp.auto_topup_threshold && cp.auto_topup_product_id,
	);
}

/**
 * Handle auto-topup by directly adding the product
 * For MVP: Just call the one-off product function directly
 */
export async function handleAutoTopup({
	db,
	customerId,
	productId,
	org,
	env,
	logger,
}: {
	db: DrizzleCli;
	customerId: string;
	productId: string;
	org: Organization;
	env: AppEnv;
	logger: any;
}) {
	try {
		logger.info(`[AUTO-TOPUP] Starting auto-topup for customer ${customerId}`);

		// Get the product
		const product = await ProductService.get({
			db,
			id: productId,
			orgId: org.id,
			env,
		});

		if (!product) {
			throw new Error(`Product ${productId} not found`);
		}

		// Get customer
		const customer = await CusService.getFull({
			db,
			idOrInternalId: customerId,
			orgId: org.id,
			env,
		});

		if (!customer) {
			throw new Error(`Customer ${customerId} not found`);
		}

		// Create attach params
		const attachBody = AttachBodySchema.parse({
			customer_id: customerId,
			product_id: productId,
		});

		// Create mock request object
		const mockReq = {
			db,
			body: attachBody,
			orgId: org.id,
			env,
			logger,
			org,
		};

		const { attachParams } = await getAttachParams({
			req: mockReq as any,
			attachBody,
		});

		// Call the one-off function to add the product
		await handleOneOffFunction({
			req: mockReq as any,
			res: null, // No response needed for internal call
			attachParams,
			config: {
				finalizeInvoice: true, // Immediately charge
				invoiceOnly: false,
			} as any,
		});

		logger.info(`[AUTO-TOPUP] ✅ Successfully topped up customer ${customerId} with product ${productId}`);
		
		return { success: true };
	} catch (error: any) {
		logger.error(`[AUTO-TOPUP] ❌ Failed for customer ${customerId}`, {
			error: error.message,
			stack: error.stack,
		});

		// For MVP: just log the error
		// Later: implement retry logic, notifications, etc.
		return { success: false, error: error.message };
	}
}

/**
 * Check if auto-topup should be triggered after usage deduction
 */
export async function checkAndTriggerAutoTopup({
	db,
	internalCustomerId,
	customerId,
	features,
	org,
	env,
	logger,
	cusEnts,
}: {
	db: DrizzleCli;
	internalCustomerId: string;
	customerId: string;
	features: any[];
	org: Organization;
	env: AppEnv;
	logger: any;
	cusEnts: any[];
}) {
	try {
		// Get auto-topup configs for this customer
		const autoTopupConfigs = await getAutoTopupConfigs({
			db,
			internalCustomerId,
		});

		if (autoTopupConfigs.length === 0) {
			return; // No auto-topup configured
		}

		logger.info(`[AUTO-TOPUP] Checking ${autoTopupConfigs.length} auto-topup configs`);

		// Check each config
		for (const config of autoTopupConfigs) {
			// Get the feature IDs from the customer entitlements for this customer_product
			const configCusEnts = cusEnts.filter(
				(ce) => ce.customer_product_id === config.id,
			);

			for (const cusEnt of configCusEnts) {
				const totalBalance = await getTotalFeatureBalance({
					db,
					internalCustomerId,
					internalFeatureId: cusEnt.internal_feature_id,
				});

				logger.info(
					`[AUTO-TOPUP] Feature ${cusEnt.feature_id}: balance=${totalBalance}, threshold=${config.auto_topup_threshold}`,
				);

				// Check if below threshold
				if (totalBalance < config.auto_topup_threshold!) {
					logger.info(
						`[AUTO-TOPUP] 🔔 Threshold reached! Triggering topup for customer ${customerId}`,
					);

					// Trigger auto-topup
					await handleAutoTopup({
						db,
						customerId,
						productId: config.auto_topup_product_id!,
						org,
						env,
						logger,
					});

					// Update the config to mark when topup was triggered (prevent rapid re-triggers)
					// For MVP: We don't have a last_topup_at field yet, but the balance will increase
					// so it won't trigger again until it drops below threshold again
					break; // Only trigger once per check
				}
			}
		}
	} catch (error: any) {
		logger.error(`[AUTO-TOPUP] Error in checkAndTriggerAutoTopup`, {
			error: error.message,
		});
		// Don't throw - we don't want to break the main usage update flow
	}
}

