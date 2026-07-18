import { Component } from '@angular/core';
import { Header } from './core/layout/header';
import { Sidebar } from './core/layout/sidebar';

@Component({
  selector: 'app-root',
  imports: [Header, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
