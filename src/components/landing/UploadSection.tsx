import { motion } from "framer-motion";
import { FileText, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDFUpload } from "@/components/PDFUpload";
import { VideoUpload } from "@/components/VideoUpload";
import React from "react";

interface UploadSectionProps {
  onFileSelect: (file: File) => void;
  onVideoSelect: (file: File) => void;
  onYouTubeSubmit: (url: string) => void;
  isProcessing: boolean;
}

export const UploadSection = React.forwardRef<HTMLDivElement, UploadSectionProps>(
  ({ onFileSelect, onVideoSelect, onYouTubeSubmit, isProcessing }, ref) => {
    return (
      <section ref={ref} className="py-16 relative" id="upload">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">
                Start Summarizing
              </h2>
              <p className="text-muted-foreground">
                Upload a document or paste a YouTube link to get started
              </p>
            </div>

            <div className="glass-card-strong p-8">
              <Tabs defaultValue="pdf" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="pdf" className="gap-2 font-display font-semibold">
                    <FileText className="h-4 w-4" />
                    PDF Document
                  </TabsTrigger>
                  <TabsTrigger value="video" className="gap-2 font-display font-semibold">
                    <Video className="h-4 w-4" />
                    Video
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pdf">
                  <PDFUpload onFileSelect={onFileSelect} isProcessing={isProcessing} />
                </TabsContent>

                <TabsContent value="video">
                  <VideoUpload
                    onVideoSelect={onVideoSelect}
                    onYouTubeSubmit={onYouTubeSubmit}
                    isProcessing={isProcessing}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }
);

UploadSection.displayName = "UploadSection";
