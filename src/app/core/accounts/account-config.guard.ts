import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TradingAccountService } from './trading-account.service';

export const accountConfigGuard: CanActivateFn = async (route, state) => {
  const accountService = inject(TradingAccountService);
  const router = inject(Router);
  const accountId = route.paramMap.get('accountId');

  if (!accountId) {
    return router.createUrlTree(['/accounts']);
  }

  const account = accountService.active() ?? (await accountService.getAccount(accountId));
  if (!account) {
    return router.createUrlTree(['/accounts']);
  }

  if (accountService.isConfigured(account)) {
    return true;
  }

  return router.createUrlTree(['/accounts', accountId, 'settings'], {
    queryParams: { returnUrl: state.url },
  });
};
