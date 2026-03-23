import { Component, OnInit } from '@angular/core';
import { ChatService } from '../../core/services/chat.service';

@Component({
  selector: 'app-products',
  standalone: true,
  styleUrls: ['./main.component.scss'],
  templateUrl: './main.component.html',
})
export class MainComponent implements OnInit {

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.chatService.getChats();
  }

}