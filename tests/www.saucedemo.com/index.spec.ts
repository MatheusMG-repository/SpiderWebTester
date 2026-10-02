import { test, expect } from '@playwright/test';
import { PageObject } from './index.page';

test.describe('Login functionality', () => {
  let pageObject: PageObject;

  test.beforeEach(async ({ page }) => {
    pageObject = new PageObject(page);
    await pageObject.goto();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await pageObject.login('standard_user', 'secret_sauce');
    expect(page.url()).toContain('/inventory.html');
  });

  test('should not login with invalid username', async ({ page }) => {
    await pageObject.login('invalid_user', 'secret_sauce');
    expect(page.url()).toBe('https://www.saucedemo.com/');
  });

  test('should not login with invalid password', async ({ page }) => {
    await pageObject.login('standard_user', 'wrong_password');
    expect(page.url()).toBe('https://www.saucedemo.com/');
  });

  test('should have disabled login button with empty username and password', async ({ page }) => {
    await pageObject.fillUsername('');
    await pageObject.fillPassword('');
    await expect(pageObject.loginButton).toBeDisabled();
  });

  test('should have disabled login button with empty username', async ({ page }) => {
    await pageObject.fillUsername('');
    await pageObject.fillPassword('secret_sauce');
    await expect(pageObject.loginButton).toBeDisabled();
  });

  test('should have disabled login button with empty password', async ({ page }) => {
    await pageObject.fillUsername('standard_user');
    await pageObject.fillPassword('');
    await expect(pageObject.loginButton).toBeDisabled();
  });
});