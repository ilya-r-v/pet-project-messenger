import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { 
  debounceTime, 
  distinctUntilChanged, 
  switchMap, 
  tap, 
  catchError, 
  takeUntil, 
  filter 
} from 'rxjs/operators';
import { ChatService } from '../../../../core/services/chat.service';
import { Message } from '../../../../models/chat.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit, OnDestroy {
  @Input() chatId!: string;
  @Output() close = new EventEmitter<void>();
  @Output() messageSelected = new EventEmitter<string>();

  searchControl = new FormControl('');
  results: Message[] = [];
  isLoading = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private chatService: ChatService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      tap((query) => {
        if (!query || query.length <= 2) {
          this.results = [];
          this.isLoading = false;
        }
      }),
      filter((query): query is string => !!query && query.length > 2),
      tap(() => {
        this.isLoading = true;
        this.results = [];
      }),
      switchMap(query => 
        this.chatService.search(this.chatId, query).pipe(
          catchError(() => of([])),
          tap(() => this.isLoading = false)
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.results = results;
    });
  }

  onClose(): void {
    this.close.emit();
  }

  goToMessage(messageId: string): void {
    this.messageSelected.emit(messageId);
    this.onClose();
  }

  highlight(content: string | undefined): SafeHtml | string {
    const query = this.searchControl.value;
    if (!query || !content) return content || '';

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    const escapedContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const highlighted = escapedContent.replace(regex, '<mark>$1</mark>');

    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}