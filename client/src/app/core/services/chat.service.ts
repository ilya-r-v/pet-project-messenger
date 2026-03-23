import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Chat } from "../../models/chat.model";

@Injectable({providedIn: 'root'})
export class ChatService{
    private baseUrl = 'http://localhost:3000/api';
    constructor(private http: HttpClient) {}

}