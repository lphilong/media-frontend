import {
  createStubCommissionBranchRoute,
  createStubModuleBranchRoute,
} from '@app/router/module-route-composition';
import { APP_PATHS } from '@app/router/paths';

describe('module route composition helpers', () => {
  it('creates standard module branch routes with explicit list/detail ownership', () => {
    const route = createStubModuleBranchRoute({
      definition: {
        id: 'org-unit',
        listPath: '/org-units',
        detailPath: '/org-units/:orgUnitId',
        detailParamKey: 'orgUnitId',
        namespace: 'org-unit',
        navGroup: 'organization',
        navItemKey: 'orgUnits',
        listTitleKey: 'org-unit:page.title',
        listSubtitleKey: 'org-unit:page.subtitle',
        detailTitleKey: 'org-unit:page.title',
        detailSubtitleKey: 'org-unit:page.subtitle',
        placeholderKey: 'org-unit:page.placeholder',
      },
      listElement: <div>List</div>,
      detailElement: <div>Detail</div>,
    });

    expect(route.path).toBe('org-units');
    expect(route.children).toHaveLength(2);
    expect(route.children?.[1]?.path).toBe(':orgUnitId');
  });

  it('creates commission child routes without hiding commission parent ownership', () => {
    const route = createStubCommissionBranchRoute({
      definition: {
        id: 'commission-rules',
        listPath: '/commission/rules',
        detailPath: '/commission/rules/:commissionRuleId',
        detailParamKey: 'commissionRuleId',
        namespace: 'commission',
        navGroup: 'commercial',
        navItemKey: 'commissionRules',
        listTitleKey: 'commission:rules.title',
        listSubtitleKey: 'commission:rules.subtitle',
        detailTitleKey: 'commission:rules.title',
        detailSubtitleKey: 'commission:rules.subtitle',
        placeholderKey: 'commission:rules.placeholder',
      },
      commissionPath: APP_PATHS.commission,
      listElement: <div>List</div>,
      detailElement: <div>Detail</div>,
    });

    expect(route.path).toBe('rules');
    expect(route.children).toHaveLength(2);
    expect(route.children?.[1]?.path).toBe(':commissionRuleId');
  });
});
