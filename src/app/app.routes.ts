import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/auth/token-input/token-input').then(m => m.TokenInputComponent)
  },
  {
    path: 'repositories',
    loadComponent: () => import('./features/repos/repo-list/repo-list').then(m => m.RepoListComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
