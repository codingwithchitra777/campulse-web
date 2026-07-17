import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

/** Thin shell for the /trades child routes. History lives at the top-level /history (Tools). */
@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './trades.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradesComponent {}
