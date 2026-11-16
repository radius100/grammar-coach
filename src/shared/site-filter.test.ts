import { describe, expect, it } from 'vitest';
import { isSiteDisabled, normalizeHost, setSiteDisabled } from './site-filter';

describe('normalizeHost', () => {
  it('lowercases and strips www', () => {
    expect(normalizeHost('https://WWW.Example.COM/path?q=1')).toBe('example.com');
  });

  it('keeps other subdomains', () => {
    expect(normalizeHost('https://mail.google.com/')).toBe('mail.google.com');
  });

  it('http is supported', () => {
    expect(normalizeHost('http://localhost:5173/')).toBe('localhost');
  });

  it('non-http schemes return null', () => {
    expect(normalizeHost('chrome://extensions')).toBeNull();
    expect(normalizeHost('file:///C:/a.txt')).toBeNull();
    expect(normalizeHost('about:blank')).toBeNull();
  });

  it('invalid url returns null', () => {
    expect(normalizeHost('not a url')).toBeNull();
    expect(normalizeHost('')).toBeNull();
  });
});

describe('isSiteDisabled', () => {
  it('exact match', () => {
    expect(isSiteDisabled('https://example.com/a', ['example.com'])).toBe(true);
  });

  it('www is ignored', () => {
    expect(isSiteDisabled('https://www.example.com/', ['example.com'])).toBe(true);
  });

  it('subdomain of entry', () => {
    expect(isSiteDisabled('https://mail.google.com/', ['google.com'])).toBe(true);
  });

  it('sibling subdomain not affected', () => {
    expect(isSiteDisabled('https://docs.google.com/', ['mail.google.com'])).toBe(false);
  });

  it('suffix without dot does not match', () => {
    expect(isSiteDisabled('https://notexample.com/', ['example.com'])).toBe(false);
  });

  it('empty or undefined list', () => {
    expect(isSiteDisabled('https://example.com/', [])).toBe(false);
    expect(isSiteDisabled('https://example.com/', undefined)).toBe(false);
  });

  it('non-http url', () => {
    expect(isSiteDisabled('chrome://extensions', ['extensions'])).toBe(false);
  });
});

describe('setSiteDisabled', () => {
  it('adds sorted without duplicates', () => {
    expect(setSiteDisabled(['b.com'], 'a.com', true)).toEqual(['a.com', 'b.com']);
    expect(setSiteDisabled(['a.com'], 'a.com', true)).toEqual(['a.com']);
  });

  it('removes host', () => {
    expect(setSiteDisabled(['a.com', 'b.com'], 'a.com', false)).toEqual(['b.com']);
  });

  it('undefined list', () => {
    expect(setSiteDisabled(undefined, 'a.com', true)).toEqual(['a.com']);
    expect(setSiteDisabled(undefined, 'a.com', false)).toEqual([]);
  });

  it('does not mutate input', () => {
    const list = ['b.com'];
    setSiteDisabled(list, 'a.com', true);
    expect(list).toEqual(['b.com']);
  });
});
