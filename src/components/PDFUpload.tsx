import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, AlertCircle, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface PDFUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PDFUpload = ({ onFileSelect, isProcessing }: PDFUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Simulate progress during processing
  useState(() => {
    if (isProcessing) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) { clearInterval(interval); return 90; }
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setProgress(isProcessing ? 0 : 100);
    }
  });

  const validateFile = (file: File): boolean => {
    if (file.type !== "application/pdf") {
      toast({ title: "Invalid file type", description: "Please upload a PDF file.", variant: "destructive" });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: `Maximum file size is 10MB. Your file is ${formatFileSize(file.size)}.`, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.type === "application/pdf");
    if (file && validateFile(file)) setSelectedFile(file);
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) setSelectedFile(file);
    e.target.value = "";
  };

  const handleUpload = () => {
    if (selectedFile) {
      setProgress(0);
      onFileSelect(selectedFile);
    }
  };

  const clearFile = () => setSelectedFile(null);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-12"
          >
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <div className="absolute inset-0 h-16 w-16 rounded-full bg-primary/20 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">Analyzing your PDF...</p>
                <p className="text-sm text-muted-foreground">Extracting text and generating summary</p>
              </div>
              <div className="w-full max-w-xs">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}% complete</p>
              </div>
            </div>
          </motion.div>
        ) : selectedFile ? (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-primary/10">
                <File className="h-10 w-10 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button onClick={handleUpload} className="animated-gradient text-primary-foreground flex-1 btn-glow">
                <FileText className="h-4 w-4 mr-2" /> Summarize PDF
              </Button>
              <Button variant="outline" onClick={clearFile}>Choose Another</Button>
            </div>
<<<<<<< HEAD
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
              title="Upload a PDF file"
            />
          </>
=======
          </motion.div>
        ) : (
          <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed p-12 transition-all duration-300 cursor-pointer
                ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50 bg-card"}`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative">
                  <div className="rounded-full bg-gradient-primary p-4">
                    <Upload className="h-12 w-12 text-primary-foreground" />
                  </div>
                  <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl -z-10" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold">Drop your PDF here</p>
                  <p className="text-sm text-muted-foreground">or click to browse your files</p>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> PDF only</span>
                  <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Max 10MB</span>
                </div>
              </div>
            </div>
          </motion.div>
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
        )}
      </AnimatePresence>
    </div>
  );
};
