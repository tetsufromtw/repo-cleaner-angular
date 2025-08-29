import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-repo-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="repo-list-page">
      <h1>Repository List</h1>
      <p>Coming soon...</p>
    </div>
  `,
  styles: [`
    .repo-list-page {
      padding: 2rem;
      text-align: center;
    }
  `]
})
export class RepoListComponent {
}