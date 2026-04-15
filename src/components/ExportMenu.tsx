import { Download, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  onExportJSON: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "icon";
}

export function ExportMenu({ onExportJSON, onExportPDF, disabled, size = "sm" }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportJSON} className="gap-2 text-xs">
          <FileJson className="h-3.5 w-3.5" /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} className="gap-2 text-xs">
          <FileText className="h-3.5 w-3.5" /> Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
