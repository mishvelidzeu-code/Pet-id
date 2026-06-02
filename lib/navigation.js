import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingTarget = null;

export function setPendingNotificationTarget(target) {
  pendingTarget = target;
}

export function flushPendingNotificationTarget() {
  if (!pendingTarget || !navigationRef.isReady()) {
    return false;
  }

  const { screen, params } = pendingTarget;
  pendingTarget = null;
  navigationRef.navigate(screen, params);
  return true;
}

export function navigateFromNotification(target) {
  if (!target?.screen) {
    return false;
  }

  if (navigationRef.isReady()) {
    navigationRef.navigate(target.screen, target.params);
    return true;
  }

  setPendingNotificationTarget(target);
  return false;
}
