import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({ name, label, type = "text", defaultValue, required = true }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} className="h-11 bg-card" />
    </div>
  );
}
