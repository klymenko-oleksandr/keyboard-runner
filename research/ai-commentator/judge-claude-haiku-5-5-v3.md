1. [approaching] AI ok: duel_bob уже на фінішній прямій, попереду лише 30 символів до мети!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить duel_bob: лишилось 30 символів! Друге місце поки за duel_ann.

2. [finish] AI ok: duel_bob фінішує на першому місці за 28 секунд! Друге місце — у duel_ann, з прогресом 74%!
   template ok: Перемога! duel_bob перетинає фінішну лінію з часом 28,0 с. Для дебюту дуже непогано: 72 WPM.

3. [approaching] AI ok: duel_ann на другому місці, лишилось 30 символів до фінішу, а duel_bob уже на першому місці!
   template ok: duel_ann теж виходить на фінішну пряму: лишилось 30 символів.

4. [finish] AI ok: duel_ann фінішує на другому місці, різниця з duel_bob — 8,7 с, а швидкість дебюту 55 WPM!
   template ok: Круг завершує duel_ann: друге місце, 36,8 с. Усі гонщики на фініші! Для дебюту дуже непогано: 55 WPM.

5. [results] AI ok: Фініш для duel_bob: перше місце за 28,0 с і 72 WPM, а duel_ann на другому!
   template ok: Гонку завершено! Фінальний результат: перше місце — duel_bob (28,0 с, 72 WPM); друге місце — duel_ann (36,8 с, 55 WPM). Вітаємо duel_bob! З вами був Таб Шифтович. До зустрічі на трасі!

6. [overtake] AI WRONG: duel_ann обходить duel_bob і вже на першому місці — різниця всього кілька відсотків!
   judge: "різниця всього кілька відсотків" — за даними обидва гравці мають однаковий прогрес 63%, тобто різниці практично немає.
   template ok: duel_ann обходить duel_bob і очолює гонку!

7. [approaching] AI ok: duel_bob на першому місці, лише 30 символів до фінішу!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить duel_bob: лишилось 30 символів! Друге місце поки за duel_ann.

8. [approaching] AI ok: Лідер duel_bob на фініші, а duel_ann тисне ззаду і лишилось 30 символів!
   template ok: duel_ann теж виходить на фінішну пряму: лишилось 30 символів.

9. [finish] AI ok: duel_bob фінішує на першому місці за 30,6 секунди, а duel_ann ще доштовхує останні символи!
   template ok: І переможець — duel_bob! Час на фініші: 30,6 с.

10. [finish] AI WRONG: duel_ann фінішує на другому місці з особистим рекордом 68 WPM! Відрив від duel_bob — 2,2 с.
   judge: "Відрив від duel_bob — 2,2 с" suggests duel_ann is ahead of duel_bob. The data says duel_ann finished second, 2,2 s behind duel_bob, who won.
   template ok: Круг завершує duel_ann: друге місце, 32,8 с. Усі гонщики на фініші! Особистий рекорд! 68 WPM, попередній найкращий результат — 55.

11. [results] AI ok: duel_bob перетинає лінію фінішу за 30,6 с, а для duel_ann — друге місце і 68 WPM!
   template ok: Гонку завершено! Фінальний результат: перше місце — duel_bob (30,6 с, 72 WPM); друге місце — duel_ann (32,8 с, 68 WPM). Вітаємо duel_bob: це вже 2 перемоги поспіль! З вами був Таб Шифтович. До зустрічі на трасі!

12. [overtake] AI WRONG: pack_cat обходить pack_dan і вже на першому місці, а pack_eve ледь починає з трьох відсотків!
   judge: "з трьох відсотків" — the data gives progress 3 with textLength 259, so it is 3 characters (about 1%), not 3 percent.
   template ok: pack_cat проривається на першу позицію, позаду лишається pack_dan!

13. [overtake] AI ok: pack_bob обходить pack_ann і піднімається на третє місце, тисне на лідерів!
   template ok: pack_bob обходить pack_ann і піднімається на третю позицію.

14. [overtake] AI ok: pack_bob обходить pack_ann і закріплюється на третьому місці, а до фінішу лишається 18 секунд!
   template ok: pack_bob обходить pack_ann і піднімається на третю позицію.

15. [approaching] AI ok: pack_dan виходить на фінішну пряму, до фінішу лишилося 30 символів!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить pack_dan: лишилось 30 символів! Друге місце може дістатися pack_cat чи pack_bob. Але давайте дочекаємось фінішу.

16. [approaching] AI WRONG: Таб Шифтович: pack_dan на фінішній прямій, до фінішу лишилось 30 символів! Друге місце — у pack_cat, а pack_bob тисне на третій позиції!
   judge: Рядок «pack_dan на фінішній прямій, до фінішу лишилось 30 символів» приписує 30 символів pack_dan. Це значення для pack_cat (88%). Для pack_dan (93% з 259 символів) лишається приблизно 18 символів.
   template ok: pack_cat теж виходить на фінішну пряму: лишилось 30 символів.

17. [approaching] AI WRONG: pack_bob обходить pack_ann і рветься на третє місце, а pack_dan вже на фінішній прямій, лишилось 30 символів!
   judge: "pack_bob обходить pack_ann і рветься на третє місце": за даними pack_ann досі третя (88%), а pack_bob четвертий (87%), тож обгону ще немає. "pack_dan ... лишилось 30 символів": 30 символів лишилось у pack_ann, а у pack_dan (98% від 259) приблизно 5.
   template ok: pack_ann теж виходить на фінішну пряму: лишилось 30 символів.

18. [approaching] AI ok: pack_bob іде на четвертому місці з 88%, до фінішу лишилось 30 символів, а pack_dan вже майже на фініші!
   template ok: pack_bob теж виходить на фінішну пряму: лишилось 30 символів.

19. [finish] AI ok: pack_dan фінішує на першому місці з 59 WPM за 53,1 с!
   template ok: І переможець — pack_dan! Час на фініші: 53,1 с. 59 WPM у першій же гонці. Запам'ятаймо це ім'я!

20. [approaching] AI WRONG: pack_eve на 88% тисне за лідером, але до фінішу ще далеко, і pack_cat уже на 96%!
   judge: "pack_eve ... тисне за лідером" – the leader pack_dan has already finished (100%), and pack_eve is last (5th) at 88%, 12 points behind, so it is not pressing the leader. "ще далеко" is also a stretch with only 30 characters left.
   template ok: pack_eve теж виходить на фінішну пряму: лишилось 30 символів.

21. [finish] AI ok: pack_cat фінішує на другому місці, відстає від pack_dan лише на 4,4 с!
   template ok: pack_cat на фініші: друге місце, час 57,5 с. Для дебюту дуже непогано: 54 WPM.

22. [finish] AI ok: pack_bob фінішує на третьому місці з часом 58,5 с, а pack_ann і pack_eve ще на фінішній прямій!
   template ok: pack_bob на фініші: третє місце, час 58,5 с. 53 WPM у першій же гонці. Запам'ятаймо це ім'я!

23. [finish] AI ok: pack_ann фінішує на четвертому місці з часом 59,1 с, відставши від pack_bob лише на 0,5 с!
   template ok: Фотофініш! pack_ann перетинає лінію лише на 0,5 с пізніше за pack_bob: четверте місце. 53 WPM у першій же гонці. Запам'ятаймо це ім'я!

24. [results] AI ok: pack_dan на першому місці з 59 WPM, а pack_eve ще біжить із 97% проти 100%!
   template ok: Фінішний прапор, час вийшов! Фінальний результат: перше місце — pack_dan (53,1 с, 59 WPM); друге місце — pack_cat (57,5 с, 54 WPM); третє місце — pack_bob (58,5 с, 53 WPM). Вітаємо pack_dan! З вами був Таб Шифтович. До зустрічі на трасі!

25. [overtake] AI ok: pack_bob обходить pack_cat і піднімається на третє місце, тисне на пакет попереду!
   template ok: pack_bob обходить pack_cat і піднімається на третю позицію.

26. [overtake] AI ok: pack_cat тримає друге місце, а pack_ann відстає на одну позицію. Ось це темп!
   template ok: Обгін! pack_cat випереджає pack_ann, тепер на другій позиції.

27. [overtake] AI ok: pack_dan обходить pack_bob і піднімається на четверте місце, тиснучи на пів-поля вперед!
   template ok: Обгін! pack_dan випереджає pack_bob, тепер на четвертій позиції.

28. [overtake] AI ok: pack_cat обходить pack_bob і піднімається на четверту позицію, тиснучи на пів кроку від pack_dan!
   template ok: pack_cat обходить pack_bob і піднімається на четверту позицію.

29. [overtake] AI ok: pack_dan обходить pack_cat і вже на четвертому місці, дихає в спину pack_bob!
   template ok: Обгін! pack_dan випереджає pack_cat, тепер на четвертій позиції.

30. [approaching] AI ok: pack_eve підходить до фінішу на першому місці, до лінії лишилося 30 символів!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить pack_eve: лишилось 30 символів! Друге місце може дістатися pack_ann чи pack_bob. Але давайте дочекаємось фінішу.

31. [overtake] AI ok: pack_cat обходить pack_bob і піднімається на третє місце!
   template ok: pack_cat обходить pack_bob і піднімається на третю позицію.

32. [finish] AI ok: Фініш! pack_eve на першому місці з особистим рекордом 62 WPM — і це за 46,6 секунди!
   template ok: Перемога! pack_eve перетинає фінішну лінію з часом 46,6 с. Особистий рекорд! 62 WPM, попередній найкращий результат — 50.

33. [approaching] AI WRONG: pack_cat обходить pack_bob і піднімається на третє місце, а до фінішу лишилось 30 символів!
   judge: «піднімається на третє місце» і «обходить pack_bob» — pack_cat уже на 2-му місці (87%), а pack_bob на 3-му (85%); також pack_eve вже фінішував(-ла) першим.
   template ok: pack_cat теж виходить на фінішну пряму: лишилось 30 символів.

34. [approaching] AI ok: pack_bob на наближенні до фінішу: pack_cat на другому місці, а pack_bob тисне з третього, лишилось 30 символів!
   template ok: pack_bob теж виходить на фінішну пряму: лишилось 30 символів.

35. [approaching] AI WRONG: pack_ann виходить на фінішну пряму, але pack_eve вже на першому місці з рекордом!
   judge: "з рекордом" is not supported: the data contains no record or record-related information. The other claims hold (pack_eve is first and finished, pack_ann is approaching the finish with 30 characters left).
   template ok: pack_ann теж виходить на фінішну пряму: лишилось 30 символів.

36. [approaching] AI ok: pack_dan теж на фінішній прямій: 30 символів до фінішу, а pack_eve уже на першому місці!
   template ok: pack_dan теж виходить на фінішну пряму: лишилось 30 символів.

37. [overtake] AI ok: pack_dan обходить pack_ann і піднімається на четверте місце, дихаючи в потилицю pack_bob!
   template ok: Обгін! pack_dan випереджає pack_ann, тепер на четвертій позиції.

38. [finish] AI ok: pack_dan фінішує на другому місці, а різниця з лідером — лише 8,4 секунди!
   template ok: pack_dan на фініші: друге місце, час 54,9 с.

39. [finish] AI ok: pack_cat фінішує на третьому місці, відстаючи від pack_dan лише на 0,6 секунди!
   template ok: Фотофініш! pack_cat перетинає лінію лише на 0,6 с пізніше за pack_dan: третє місце.

40. [finish] AI ok: pack_bob фінішує на четвертому місці, лише 0,5 с відстаючи від pack_cat!
   template ok: Фотофініш! pack_bob перетинає лінію лише на 0,5 с пізніше за pack_cat: четверте місце.

41. [finish] AI ok: pack_ann фінішує на п'ятому місці, а відрив від pack_bob — лише 0,2 с!
   template ok: Фотофініш! pack_ann перетинає лінію лише на 0,2 с пізніше за pack_bob: п'яте місце.

42. [results] AI ok: Фініш для pack_eve: перше місце і 62 WPM, а pack_dan відіграє шлях з п'ятого місця на друге!
   template ok: Гонку завершено! Фінальний результат: перше місце — pack_eve (46,6 с, 62 WPM); друге місце — pack_dan (54,9 с, 52 WPM); третє місце — pack_cat (55,5 с, 52 WPM). Камбек дня — pack_dan: посеред гонки лише п'ята позиція, а на фініші друге місце! Вітаємо pack_eve! З вами був Таб Шифтович. До зустрічі на трасі!

43. [overtake] AI ok: slow_cat обходить slow_ann і виходить на третє місце, тисне на піт-лейн лідерів!
   template ok: Обгін! slow_cat випереджає slow_ann, тепер на третій позиції.

44. [approaching] AI ok: slow_dan на фінішній прямій, на першому місці, до фінішу ще 30 символів!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить slow_dan: лишилось 30 символів! Друге місце може дістатися slow_cat чи slow_bob. Але давайте дочекаємось фінішу.

45. [approaching] AI ok: slow_dan ще на першому місці, але для slow_cat на другому місці лишилось 30 символів до фінішу!
   template ok: slow_cat теж виходить на фінішну пряму: лишилось 30 символів.

46. [finish] AI WRONG: slow_dan фінішує на першому місці за 56 секунд, дебют на трасі «Чайка»!
   judge: The line says "дебют на трасі «Чайка»", but the data has no track name. It only says this is slow_dan's debut (speed.kind = debut, 44 wpm). The track name is invented.
   template ok: Фінішну пряму перетинає slow_dan, і це перше місце! Час: 56,2 с. Для дебюту дуже непогано: 44 WPM.

47. [results] AI ok: Фінішує slow_dan на першому місці: 56,2 с і 44 WPM для дебюту!
   template ok: Фінішний прапор, час вийшов! Фінальний результат: перше місце — slow_dan (56,2 с, 44 WPM); друге місце — slow_cat (91% дистанції); третє місце — slow_bob (75% дистанції). Камбек дня — slow_cat: посеред гонки лише четверта позиція, а на фініші друге місце! Вітаємо slow_dan! З вами був Таб Шифтович. До зустрічі на трасі!

48. [approaching] AI ok: solo_ann фінішує на першому місці, лишилося зовсім трохи — тримайте темп!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить solo_ann: лишилось 30 символів! Залишилось лише дотиснути!

49. [finish] AI ok: solo_ann фінішує на першому місці з часом 42,7 секунди і швидкістю 62 WPM, це дебютний рекорд!
   template ok: Перемога! solo_ann перетинає фінішну лінію з часом 42,7 с. Для дебюту дуже непогано: 62 WPM.

50. [results] AI ok: solo_ann фінішує на першому місці з часом 42,7 с і 62 WPM для дебюту: дуже непогано!
   template ok: Гонку завершено! Фінальний результат: перше місце — solo_ann (42,7 с, 62 WPM). Вітаємо solo_ann! З вами був Таб Шифтович. До зустрічі на трасі!

51. [overtake] AI ok: spread_bob обходить spread_cat і вже на першому місці, тримає 16% тексту!
   template ok: spread_bob обходить spread_cat і очолює гонку!

52. [approaching] AI ok: spread_cat на фінішній прямій, залишилося 30 символів, і відрив від spread_bob вже відчутний!
   template ok: До фінішу зовсім небагато, і на фінішну пряму виходить spread_cat: лишилось 30 символів! Друге місце може дістатися spread_bob чи spread_ann. Але давайте дочекаємось фінішу.

53. [approaching] AI ok: spread_bob наздоганяє, до фінішу лишається 30 символів, відрив від лідера скорочується!
   template ok: spread_bob теж виходить на фінішну пряму: лишилось 30 символів.

54. [finish] AI ok: spread_cat фінішує на першому місці за 43,8 секунди! Дебют із 61 WPM!
   template ok: Перемога! spread_cat перетинає фінішну лінію з часом 43,8 с. Для дебюту дуже непогано: 61 WPM.

55. [finish] AI WRONG: Друге місце — у spread_bob, відрив від spread_cat лише 3,6 с, а фініш за 47,4 с і 57 WPM для дебюту!
   judge: «відрив від spread_cat лише 3,6 с» звучить так, ніби spread_bob випереджає spread_cat. За даними spread_bob фінішував другим, на 3,6 с пізніше за spread_cat, тобто це відставання, а не відрив.
   template ok: Фінішну пряму перетинає spread_bob: друге місце, 47,4 с. Для дебюту дуже непогано: 57 WPM.

56. [results] AI WRONG: Фініш: spread_cat перше місце з часом 43,8 с і 61 WPM! Друге місце — у spread_bob, а spread_ann ще дорисовує трасу.
   judge: "spread_ann ще дорисовує трасу" suggests she is still racing, but the race is over (secondsLeft 0) and she did not finish, stopping at 83%.
   template ok: Фінішний прапор, час вийшов! Фінальний результат: перше місце — spread_cat (43,8 с, 61 WPM); друге місце — spread_bob (47,4 с, 57 WPM); третє місце — spread_ann (83% дистанції). Вітаємо spread_cat! З вами був Таб Шифтович. До зустрічі на трасі!