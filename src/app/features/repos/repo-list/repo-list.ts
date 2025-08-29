import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { RepositoryStore } from '../../../data-access/repository.store';
import { GitHubService } from '../../../data-access/github.service';
import { GitHubRepository } from '../../../data-access/github-types';
import { UiButtonComponent, UiCardComponent } from '../../../shared/components/ui';

interface LanguageColor {
  [key: string]: string;
}

@Component({
  selector: 'app-repo-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    UiButtonComponent,
    UiCardComponent
  ],
  templateUrl: './repo-list.html',
  styleUrl: './repo-list.scss'
})
export class RepoListComponent implements OnInit {
  private readonly githubService = inject(GitHubService);
  private readonly router = inject(Router);
  
  readonly store = inject(RepositoryStore);
  readonly isProcessing = signal(false);

  // Language colors for repository language indicators
  private readonly languageColors: LanguageColor = {
    'TypeScript': '#3178c6',
    'JavaScript': '#f1e05a',
    'Python': '#3572A5',
    'Java': '#b07219',
    'HTML': '#e34c26',
    'CSS': '#1572b6',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'C++': '#f34b7d',
    'C': '#555555',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Swift': '#fa7343',
    'Kotlin': '#A97BFF',
    'Dart': '#00B4AB',
    'Shell': '#89e051',
    'Vue': '#41b883',
    'React': '#61dafb'
  };

  // Computed properties
  readonly availableLanguages = computed(() => {
    const languages = new Set<string>();
    this.store.repositories().forEach(repo => {
      if (repo.language) {
        languages.add(repo.language);
      }
    });
    return Array.from(languages).sort();
  });

  async ngOnInit() {
    // トークンがない場合はログインページにリダイレクト
    if (!this.githubService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    // リポジトリを読み込む
    await this.loadRepositories();
  }

  private async loadRepositories() {
    try {
      await this.store.loadRepositories();
    } catch (error) {
      console.error('Failed to load repositories:', error);
      // トークンエラーの場合はログインページにリダイレクト
      if (this.isTokenError(error)) {
        this.router.navigate(['/']);
      }
    }
  }

  private isTokenError(error: any): boolean {
    return error?.status === 401 || error?.status === 403;
  }

  // Quick Filter Methods
  toggleQuickFilter(filterType: string) {
    const currentFilters = this.store.filters();
    let currentValue = false;
    
    switch (filterType) {
      case 'inactive':
        currentValue = currentFilters.inactive || false;
        this.store.setFilter('inactive', !currentValue);
        break;
      case 'noStars':
        currentValue = currentFilters.noStars || false;
        this.store.setFilter('noStars', !currentValue);
        break;
      case 'forked':
        currentValue = currentFilters.forked || false;
        this.store.setFilter('forked', !currentValue);
        break;
      case 'archived':
        currentValue = currentFilters.archived || false;
        this.store.setFilter('archived', !currentValue);
        break;
    }
  }

  // Filter Update Methods
  updateFilter(key: string, value: any) {
    switch (key) {
      case 'search':
        this.store.setFilter('search', value);
        break;
      case 'language':
        this.store.setFilter('language', value);
        break;
      case 'visibility':
        this.store.setFilter('visibility', value);
        break;
    }
  }

  clearAllFilters() {
    this.store.clearFilters();
  }

  // Sort Methods
  updateSort(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target?.value) {
      this.store.setSortBy(target.value);
    }
  }

  toggleSortDirection() {
    const current = this.store.sortDirection();
    this.store.setSortDirection(current === 'asc' ? 'desc' : 'asc');
  }

  // Selection Methods
  toggleSelection(repoId: number) {
    if (this.store.isSelected(repoId)) {
      this.store.deselectRepository(repoId);
    } else {
      this.store.selectRepository(repoId);
    }
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.store.deselectAll();
    } else {
      const filtered = this.store.filteredRepositories();
      filtered.forEach(repo => this.store.selectRepository(repo.id));
    }
  }

  isAllSelected(): boolean {
    const filtered = this.store.filteredRepositories();
    const selected = this.store.selectedRepositories();
    const selectedIds = selected.map(repo => repo.id);
    return filtered.length > 0 && filtered.every(repo => selectedIds.includes(repo.id));
  }

  isSomeSelected(): boolean {
    const filtered = this.store.filteredRepositories();
    const selected = this.store.selectedRepositories();
    const selectedIds = selected.map(repo => repo.id);
    const selectedInFiltered = filtered.filter(repo => selectedIds.includes(repo.id));
    return selectedInFiltered.length > 0 && selectedInFiltered.length < filtered.length;
  }

  // Repository Action Methods
  async toggleArchive(repo: GitHubRepository) {
    if (this.isProcessing()) return;

    this.isProcessing.set(true);
    try {
      if (repo.archived) {
        await this.store.unarchiveRepository(repo.id);
      } else {
        await this.store.archiveRepository(repo.id);
      }
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
      // TODO: Add user-friendly error notification
    } finally {
      this.isProcessing.set(false);
    }
  }

  async deleteRepository(repo: GitHubRepository) {
    if (this.isProcessing()) return;

    // TODO: Add confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${repo.name}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    this.isProcessing.set(true);
    try {
      await this.store.deleteRepository(repo.id);
    } catch (error) {
      console.error('Failed to delete repository:', error);
      // TODO: Add user-friendly error notification
    } finally {
      this.isProcessing.set(false);
    }
  }

  // Batch Operation Methods
  async batchArchive() {
    if (this.isProcessing()) return;
    const selected = this.store.selectedRepositories();
    const selectedIds = selected.map(repo => repo.id);
    
    if (selectedIds.length === 0) return;

    this.isProcessing.set(true);
    try {
      await this.store.batchArchive(selectedIds);
      this.store.deselectAll();
    } catch (error) {
      console.error('Failed to batch archive:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async batchUnarchive() {
    if (this.isProcessing()) return;
    const selected = this.store.selectedRepositories();
    const selectedIds = selected.map(repo => repo.id);
    
    if (selectedIds.length === 0) return;

    this.isProcessing.set(true);
    try {
      await this.store.batchUnarchive(selectedIds);
      this.store.deselectAll();
    } catch (error) {
      console.error('Failed to batch unarchive:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async batchDelete() {
    if (this.isProcessing()) return;
    const selected = this.store.selectedRepositories();
    const selectedIds = selected.map(repo => repo.id);
    
    if (selectedIds.length === 0) return;

    // TODO: Add proper confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} repositories? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    this.isProcessing.set(true);
    try {
      await this.store.batchDelete(selectedIds);
      this.store.deselectAll();
    } catch (error) {
      console.error('Failed to batch delete:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  // Utility Methods
  trackByRepoId(index: number, repo: GitHubRepository): number {
    return repo.id;
  }

  getLanguageColor(language: string): string {
    return this.languageColors[language] || '#8b949e';
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} days ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} months ago`;
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} years ago`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    
    return `${size} ${sizes[i]}`;
  }
}