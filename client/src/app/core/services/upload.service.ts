import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable, switchMap, map, filter, of, concatMap } from 'rxjs';

export interface UploadProgress {
  progress: number;
  url?: string;
  thumbnailUrl?: string;
  key?: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  uploadFile(chatId: string, file: File): Observable<UploadProgress> {
    return this.http
      .post<{ key: string; uploadUrl: string }>(`${this.baseUrl}/upload/presigned`, {
        chatId,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      })
      .pipe(
        switchMap(({ key, uploadUrl }) => {
          const blob = new Blob([file], { type: '' });
            return this.http.put(uploadUrl, blob, {
              reportProgress: true,
              observe: 'events',
              headers: { 'Content-Type': '' }
          })
            .pipe(
              concatMap((event: HttpEvent<any>) => {
                if (event.type === HttpEventType.UploadProgress) {
                  const progress = Math.round((100 * (event.loaded ?? 0)) / (event.total ?? 1));
                  return of({ progress });
                }

                if (event.type === HttpEventType.Response) {
                  return this.http
                    .post<{ url: string; thumbnailUrl: string | null; key: string; }>(
                      `${this.baseUrl}/upload/confirm`,
                      { key, contentType: file.type }
                    )
                    .pipe(
                      map(confirmed => ({
                        progress: 100,
                        url: confirmed.url,
                        thumbnailUrl: confirmed.thumbnailUrl ?? undefined,
                        key: confirmed.key,
                      }))
                    );
                }
                return of(null);
              }),
              filter((result): result is UploadProgress => result !== null)
            );
        })
      );
  }
}