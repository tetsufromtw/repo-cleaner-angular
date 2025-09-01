import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { TokenInputComponent } from './token-input';

describe('TokenInputComponent', () => {
  let component: TokenInputComponent;
  let fixture: ComponentFixture<TokenInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenInputComponent, HttpClientTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TokenInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
