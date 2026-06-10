import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TradingAccountService } from './trading-account.service';

export const accountOwnershipGuard: CanActivateFn = async (route) => {
  const accountService = inject(TradingAccountService);
  const router = inject(Router);
  const accountId = route.paramMap.get('accountId');

  if (!accountId) {
    return router.createUrlTree(['/accounts']);
  }

  try {
    const account = await accountService.getAccount(accountId);
    if (!account) {
      return router.createUrlTree(['/accounts']);
    }
    return true;
  } catch {
    return router.createUrlTree(['/accounts']);
  }
};
