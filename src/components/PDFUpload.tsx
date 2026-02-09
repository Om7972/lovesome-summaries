import { useState, useCallback } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PDFUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export const PDFUpload = ({ onFileSelect, isProcessing }: PDFUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === "application/pdf");

    if (pdfFile) {
      onFileSelect(pdfFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
    }
  }, [onFileSelect, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      onFileSelect(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative rounded-2xl border-2 border-dashed p-12 transition-all duration-300
        ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border bg-card"}
        ${isProcessing ? "opacity-50 pointer-events-none" : "hover:border-primary/50"}
      `}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {isProcessing ? (
          <>
            <div className="relative">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <div className="absolute inset-0 h-16 w-16 rounded-full bg-primary/20 animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold">Processing your PDF...</p>
              <p className="text-sm text-muted-foreground">
                AI is analyzing your document
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="rounded-full bg-gradient-primary p-4">
                <Upload className="h-12 w-12 text-primary-foreground" />
              </div>
              <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl -z-10" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-semibold">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse your files
              </p>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground items-center">
              <FileText className="h-4 w-4" />
              <span>Supports PDF files up to 20MB</span>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
              title="Upload a PDF file"
            />
          </>
        )}
      </div>
    </div>
  );
};
