import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { QuickNote } from './app/features/quick-note/quick-note';

// The quick-note window reuses this bundle; the hash decides which root boots.
const root = location.hash === '#quick-note' ? QuickNote : App;
bootstrapApplication(root, appConfig).catch((err) => console.error(err));
