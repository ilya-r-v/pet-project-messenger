import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable, switchMap, map, filter } from 'rxjs';

export interface UploadProgress {
  progress: number;       // 0–100
  url?: string;           // финальный URL после завершения
  thumbnailUrl?: string;
  key?: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  uploadFile(
    chatId: string,
    file: File,
  ): Observable<UploadProgress> {
    return this.http
      .post<{ key: string; uploadUrl: string }>(`${this.baseUrl}/upload/presigned`, {
        chatId,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      })
      .pipe(
        switchMap(({ key, uploadUrl }) =>
          this.http
            .put(uploadUrl, file, {
              headers: { 'Content-Type': file.type },
              reportProgress: true,
              observe: 'events',
            })
            .pipe(
              map(event => {
                if (event.type === HttpEventType.UploadProgress) {
                  const progress = Math.round(
                    (100 * (event.loaded ?? 0)) / (event.total ?? 1),
                  );
                  return { progress };
                }
                if (event.type === HttpEventType.Response) {
                  return { progress: 100, key };
                }
                return null;
              }),
              filter(Boolean),
              switchMap(result => {
                if (result.progress < 100 || !result.key) {
                  return [result as UploadProgress];
                }
                return this.http
                  .post<{ url: string; thumbnailUrl: string | null; key: string }>(
                    `${this.baseUrl}/upload/confirm`,
                    { key: result.key, contentType: file.type },
                  )
                  .pipe(
                    map(confirmed => ({
                      progress: 100,
                      url: confirmed.url,
                      thumbnailUrl: confirmed.thumbnailUrl ?? undefined,
                      key: confirmed.key,
                    })),
                  );
              }),
            ),
        ),
      );
  }
}