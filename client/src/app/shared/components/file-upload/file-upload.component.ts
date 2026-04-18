import {
  Component, Input, Output, EventEmitter,
  HostListener, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { NgIf, NgStyle } from '@angular/common';
import { UploadService, UploadProgress } from '../../../core/services/upload.service';

export interface UploadedFile {
  key: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  type: string;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  //imports: [NgStyle],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadComponent {
  @Input() chatId!: string;
  @Output() uploaded = new EventEmitter<UploadedFile>();
  @Output() cancelled = new EventEmitter<void>();

  isDragOver = false;
  preview: string | null = null;
  selectedFile: File | null = null;
  progress = 0;
  isUploading = false;
  errorMessage = '';

  constructor(
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
    this.cdr.markForCheck();
  }

  @HostListener('dragleave')
  onDragLeave(): void {
    this.isDragOver = false;
    this.cdr.markForCheck();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.selectFile(file);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.selectFile(file);
  }

  selectFile(file: File): void {
    this.errorMessage = '';
    this.selectedFile = file;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.preview = reader.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    } else {
      this.preview = null;
    }

    this.cdr.markForCheck();
  }

  upload(): void {
    if (!this.selectedFile || this.isUploading) return;

    this.isUploading = true;
    this.progress = 0;
    this.errorMessage = '';

    this.uploadService.uploadFile(this.chatId, this.selectedFile).subscribe({
      next: (result: UploadProgress) => {
        this.progress = result.progress;

        if (result.progress === 100 && result.url && result.key) {
          this.uploaded.emit({
            key: result.key,
            url: result.url,
            thumbnailUrl: result.thumbnailUrl,
            name: this.selectedFile!.name,
            type: this.selectedFile!.type,
          });
          this.reset();
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err.error?.message ?? 'Ошибка загрузки';
        this.isUploading = false;
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.selectedFile = null;
    this.preview = null;
    this.progress = 0;
    this.isUploading = false;
    this.cdr.markForCheck();
  }

  get fileSizeMb(): string {
    if (!this.selectedFile) return '';
    return (this.selectedFile.size / 1024 / 1024).toFixed(1);
  }
}