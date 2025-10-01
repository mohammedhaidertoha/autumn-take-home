import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCusQuery } from "../../hooks/useCusQuery";
import { useProductsQuery } from "@/hooks/queries/useProductsQuery";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { toast } from "sonner";
import { getBackendErr } from "@/utils/genUtils";
import { Trash2 } from "lucide-react";
import { CusProductStatus } from "@autumn/shared";

export const AutoTopupConfig = () => {
	const { customer, refetch } = useCusQuery();
	const { products } = useProductsQuery();
	const axiosInstance = useAxiosInstance();

	const [threshold, setThreshold] = useState<number>(100);
	const [selectedCusProduct, setSelectedCusProduct] = useState<string>("");
	const [topupProduct, setTopupProduct] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const [existingConfigs, setExistingConfigs] = useState<any[]>([]);

	// Get auto-topup enabled products
	const autoTopupProducts = products?.filter((p: any) => p.is_auto_topup) || [];

	// Get active customer products
	const activeCustomerProducts =
		customer?.customer_products?.filter(
			(cp: any) => cp.status === CusProductStatus.Active,
		) || [];

	// Load existing auto-topup configs
	useEffect(() => {
		const loadConfigs = async () => {
			try {
				const response = await axiosInstance.get(
					`/customers/${customer.id}/auto-topup`,
				);
				setExistingConfigs(response.data.configs || []);
			} catch (error) {
				console.error("Failed to load auto-topup configs:", error);
			}
		};

		if (customer?.id) {
			loadConfigs();
		}
	}, [customer?.id, axiosInstance]);

	const handleConfigure = async () => {
		if (!selectedCusProduct || !topupProduct || !threshold) {
			toast.error("Please fill in all fields");
			return;
		}

		setLoading(true);
		try {
			await axiosInstance.post(`/customers/${customer.id}/auto-topup`, {
				customer_product_id: selectedCusProduct,
				threshold: Number(threshold),
				topup_product_id: topupProduct,
			});

			toast.success("Auto top-up configured successfully");
			refetch();

			// Reload configs
			const response = await axiosInstance.get(
				`/customers/${customer.id}/auto-topup`,
			);
			setExistingConfigs(response.data.configs || []);

			// Reset form
			setSelectedCusProduct("");
			setTopupProduct("");
			setThreshold(100);
		} catch (error) {
			toast.error(getBackendErr(error, "Failed to configure auto top-up"));
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (customerProductId: string) => {
		setLoading(true);
		try {
			await axiosInstance.delete(
				`/customers/${customer.id}/auto-topup/${customerProductId}`,
			);

			toast.success("Auto top-up disabled");
			refetch();

			// Reload configs
			const response = await axiosInstance.get(
				`/customers/${customer.id}/auto-topup`,
			);
			setExistingConfigs(response.data.configs || []);
		} catch (error) {
			toast.error(getBackendErr(error, "Failed to disable auto top-up"));
		} finally {
			setLoading(false);
		}
	};

	if (!customer || !products) {
		return <div className="text-sm text-t3">Loading...</div>;
	}

	if (autoTopupProducts.length === 0) {
		return (
			<div className="text-sm text-t3">
				No auto top-up products available. Create a product with "Auto Top-Up"
				enabled.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Existing Configurations */}
			{existingConfigs.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label className="text-xs text-t3">Active Configurations</Label>
					{existingConfigs.map((config: any) => {
						const cusProduct = activeCustomerProducts.find(
							(cp: any) => cp.id === config.customer_product_id,
						);
						const topupProd = products.find(
							(p: any) => p.id === config.topup_product_id,
						);

						return (
							<div
								key={config.customer_product_id}
								className="flex items-center justify-between p-2 border rounded text-xs"
							>
								<div className="flex flex-col gap-1">
									<span className="text-t2 font-medium">
										{cusProduct?.product?.name || "Unknown"}
									</span>
									<span className="text-t3">
										Threshold: {config.threshold} credits
									</span>
									<span className="text-t3">
										Top-up: {topupProd?.name || config.topup_product_id}
									</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDelete(config.customer_product_id)}
									disabled={loading}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						);
					})}
				</div>
			)}

			{/* New Configuration Form */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="customer-product" className="text-xs text-t3">
						Customer Product
					</Label>
					<Select value={selectedCusProduct} onValueChange={setSelectedCusProduct}>
						<SelectTrigger id="customer-product" className="text-sm">
							<SelectValue placeholder="Select product..." />
						</SelectTrigger>
						<SelectContent>
							{activeCustomerProducts.map((cp: any) => (
								<SelectItem key={cp.id} value={cp.id} className="text-sm">
									{cp.product?.name || cp.product_id}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="threshold" className="text-xs text-t3">
						Threshold (credits)
					</Label>
					<Input
						id="threshold"
						type="number"
						value={threshold}
						onChange={(e) => setThreshold(Number(e.target.value))}
						placeholder="100"
						className="text-sm"
						min={0}
					/>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="topup-product" className="text-xs text-t3">
						Top-Up Product
					</Label>
					<Select value={topupProduct} onValueChange={setTopupProduct}>
						<SelectTrigger id="topup-product" className="text-sm">
							<SelectValue placeholder="Select top-up product..." />
						</SelectTrigger>
						<SelectContent>
							{autoTopupProducts.map((p: any) => (
								<SelectItem key={p.id} value={p.id} className="text-sm">
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button
					onClick={handleConfigure}
					disabled={loading || !selectedCusProduct || !topupProduct}
					className="w-full"
					size="sm"
				>
					{loading ? "Configuring..." : "Configure Auto Top-Up"}
				</Button>
			</div>
		</div>
	);
};

