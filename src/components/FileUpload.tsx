import { useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  accept: string;
  acceptLabel: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

const FileUpload = ({ accept, acceptLabel, file, onFileSelect }: FileUploadProps) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const removeFile = () => {
    onFileSelect(null);
  };

  if (file) {
    return (
      <div className="upload-zone flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={removeFile}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="upload-zone cursor-pointer block"
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-7 h-7 text-primary" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            Click to upload or drag and drop
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {acceptLabel}
          </p>
        </div>
      </div>
    </label>
  );
};

export default FileUpload;
