import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TokenInputComponent } from './token-input';

describe('TokenInputComponent', () => {
  let component: TokenInputComponent;
  let fixture: ComponentFixture<TokenInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenInputComponent]
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
