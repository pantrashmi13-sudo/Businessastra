import { createFileRoute } from "@tanstack/react-router";
import { MasterCrudPage } from "@/components/masters/MasterCrudPage";
import { companySchema, companyFields } from "@/components/masters/schemas";

export const Route = createFileRoute("/masters/companies")({
  component: () => (
    <MasterCrudPage
      title="Companies"
      description="Your legal entity. VAT/PAN details are used for tax calculations on bills."
      table="companies"
      schema={companySchema}
      fields={companyFields}
      searchKeys={["name", "vat_number", "city", "state"]}
      disableNew={true}
      disableDelete={true}
      columns={[
        { key: "name", label: "Name" },
        { key: "vat_number", label: "VAT Number" },
        { key: "state", label: "State" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
      ]}
    />
  ),
});
