import { useState } from "react";
import { Upload, Video, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onYouTubeSubmit: (url: string) => void;
  isProcessing: boolean;
}

export const VideoUpload = ({ onVideoSelect, onYouTubeSubmit, isProcessing }: VideoUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      onVideoSelect(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelect(file);
    }
  };

  const handleYouTubeSubmit = () => {
    if (youtubeUrl.trim()) {
      onYouTubeSubmit(youtubeUrl.trim());
    }
  };

  return (
    <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Video
          </TabsTrigger>
          <TabsTrigger value="youtube" className="gap-2">
            <Link className="h-4 w-4" />
            YouTube Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border/50 hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />

            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Video className="h-8 w-8 text-primary" />
              </div>

              <div>
                <p className="text-lg font-semibold mb-2">
                  {isDragging ? "Drop your video here" : "Drag & drop your video"}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (MP4, MOV, AVI, MKV, WebM)
                </p>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-2 text-primary">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Processing video...</span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="youtube">
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="p-4 rounded-full bg-accent/10">
                <Link className="h-8 w-8 text-accent" />
              </div>
              <p className="text-lg font-semibold">Paste YouTube Link</p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                onClick={handleYouTubeSubmit}
                disabled={!youtubeUrl.trim() || isProcessing}
                className="shrink-0"
              >
                {isProcessing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Processing
                  </>
                ) : (
                  "Summarize Video"
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Supports YouTube videos with captions or audio
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
