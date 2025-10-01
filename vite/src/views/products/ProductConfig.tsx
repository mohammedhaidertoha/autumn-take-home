import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import FieldLabel from "@/components/general/modal-components/FieldLabel";
import { Product } from "@autumn/shared";
import { useState } from "react";
import { slugify } from "@/utils/formatUtils/formatTextUtils";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export const ProductConfig = ({
	product,
	setProduct,
	isUpdate = false,
}: {
	product: any;
	setProduct: (product: any) => void;
	isUpdate?: boolean;
}) => {
	const [idEdit, setIdEdit] = useState(isUpdate);

	return (
		<div className="flex w-full gap-4">
			<div className="w-1/2">
				<FieldLabel>Name</FieldLabel>
				<Input
					placeholder="e.g. Starter Product"
					value={product.name}
					onChange={(e) => {
						const newFields = { ...product, name: e.target.value };
						if (!idEdit && !isUpdate) {
							newFields.id = slugify(e.target.value);
						}
						setProduct(newFields);
					}}
				/>
			</div>
			<div className="w-1/2">
				<FieldLabel>ID</FieldLabel>
				<div className="flex items-center gap-2 h-10">
					{idEdit ? (
						<Input
							autoFocus={idEdit}
							placeholder="e.g. product-id"
							value={product.id}
							onChange={(e) => {
								setProduct({ ...product, id: slugify(e.target.value) });
							}}
						/>
					) : (
						<span className="text-sm text-t2 px-3">{product.id || "..."}</span>
					)}
					{!isUpdate && (
						<Pencil
							size={16}
							className={cn(
								"text-t3 cursor-pointer",
								idEdit && "text-brand-purple",
							)}
							onClick={() => setIdEdit(!idEdit)}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
