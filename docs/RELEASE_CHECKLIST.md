# Release Checklist

## M0 kalite kapıları

- [ ] `npm ci`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run db:verify`
- [ ] `npm run smoke:export`
- [ ] `npm audit --audit-level=critical`
- [ ] Secret scan
- [ ] Welcome ve Child Home iOS gerçek cihaz/simulator
- [ ] Welcome ve Child Home Android gerçek cihaz/emulator
- [ ] Screen reader ve büyük yazı manuel kontrolü
- [ ] Privacy/data safety beyanı gerçek davranışla eşleşiyor
- [ ] Production secret repository’de yok

Bu liste release yaklaşırken tamamlanır; M0 doğrulama sonuçları görev raporunda yer alır.
