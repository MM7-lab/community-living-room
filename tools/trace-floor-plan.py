#!/usr/bin/env python3
# 用法：python3 tools/trace-floor-plan.py  → 重新生成 data/plan.json（地下）同 data/plan-1f.json（一樓）
# 由竣工平面圖（Yuen Fat，2024-06-27，1:100）量度：單位 cm；x = 0 喺 E 軸線，y = 0 喺後牆內面，y 向前（大門）增加。
import json, math, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
J = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
def P(x, y): return {'x': x, 'y': y}
class Plan:
    def __init__(s): s.rooms, s.walls, s.items, s.n = [], [], [], 0
    def id(s, p): s.n += 1; return f'{p}{s.n}'
    def wall(s, a, b, glass=False):
        w = {'id': s.id('w'), 'a': P(*a), 'b': P(*b)}
        if glass: w['glass'] = True
        s.walls.append(w)
    def item(s, t, x, y, w, h, r=0, ht=None):
        it = {'id': s.id('i'), 'type': t, 'x': round(x, 1), 'y': round(y, 1), 'w': w, 'h': h, 'r': r}
        if ht is not None: it['ht'] = ht
        s.items.append(it)
    # 門：喺牆 a→b 上面，由沿牆距離 s0 到 s1，向 n（單位向量）嗰邊開
    def door(s, a, b, s0, s1, n, t='door'):
        L = math.hypot(b[0]-a[0], b[1]-a[1]); ux, uy = (b[0]-a[0])/L, (b[1]-a[1])/L
        w = s1 - s0; h = w if t == 'door' else w / 2
        mx, my = a[0] + ux*(s0+s1)/2, a[1] + uy*(s0+s1)/2
        r = round(math.degrees(math.atan2(n[0], -n[1]))) % 360
        s.item(t, mx + n[0]*h/2, my + n[1]*h/2, w, h, r, 210)
    def window(s, a, b, s0, s1):
        L = math.hypot(b[0]-a[0], b[1]-a[1]); ux, uy = (b[0]-a[0])/L, (b[1]-a[1])/L
        r = round(math.degrees(math.atan2(uy, ux))) % 360
        s.item('window', a[0]+ux*(s0+s1)/2, a[1]+uy*(s0+s1)/2, s1-s0, 10, r)
    def dump(s, path, note):
        lines = ['{', '  "format": "office-floor-plan",', '  "version": 2,', f'  "note": {J(note)},', '  "layout": {', '    "rooms": [',
                 ',\n'.join('      '+J(r) for r in s.rooms), '    ],', '    "walls": [', ',\n'.join('      '+J(w) for w in s.walls), '    ]', '  },',
                 '  "items": [', ',\n'.join('    '+J(i) for i in s.items), '  ]', '}']
        open(path, 'w', encoding='utf8').write('\n'.join(lines)+'\n')
N, S, E, W = (0,-1), (0,1), (1,0), (-1,0)

# ================= 地下 G/F =================
g = Plan()
g.rooms.append({'id': 'gf', 'pts': [P(-80,0), P(600,0), P(600,1575), P(-437,1575), P(-437,245), P(-80,245)]})
FRONT = ((600,1575), (-437,1575))  # 前面外牆（由右至左）
# Pantry（教學區、分享區、用餐區）
g.wall((203,0), (203,548)); g.door((203,0), (203,548), 435, 518, E)          # DR-02 去斜台
g.wall((203,548), (355,548)); g.wall((263,548), (263,795))
g.wall((-437,795), (-345,795)); g.wall((-345,795), (-105,795), glass=True); g.wall((-105,795), (263,795))  # 半玻璃間隔
g.item('column', -20, 792, 40, 95)
# 洗手間 1–3、送餐升降機
g.item('column', 275, 80, 140, 160)                                          # 送餐升降機
g.wall((203,415), (347,415))
g.wall((347,0), (347,415)); g.door((347,0), (347,415), 350, 410, W)          # Lav 1
g.wall((347,250), (600,250)); g.door((347,250), (600,250), 18, 113, S); g.door((347,250), (600,250), 191, 251, N)  # Lav 2、Lav 3
g.item('column', 517, 125, 35, 250)
g.wall((520,400), (600,400))                                                # 洗衣區短間隔
# 儲物室 1（樓梯底）、大門口（Foyer）
g.wall((475,1225), (475,1455)); g.door((475,1225), (475,1455), 15, 75, W)
g.wall((340,1455), (475,1455))
g.wall((340,1455), (340,1575)); g.door((340,1455), (340,1575), 10, 90, W)    # DR-05
# 前面：窗、側門（DR-04）、大門口
g.window((-437,1575), (600,1575), 17, 277)                                   # x -420..-160
g.door(*FRONT, 641, 745, N)                                                  # DR-04（x -145..-41）
g.window((-437,1575), (600,1575), 437, 772)                                  # 玻璃 x 0..335
g.door(*FRONT, 10, 250, N, 'door2')                                          # 大門口 x 350..590
g.item('column', -425, 1550, 30, 50); g.item('column', -17, 1552, 35, 55)
# 教學區：煮食爐同洗手盆（左牆、頂）、教學工作枱
for y in (365, 535, 705): g.item('kitchen_counter', -398, y, 168, 60, 270)
g.item('kitchen_counter', -115, 284, 230, 60, 0)
g.item('kitchen_counter', -130, 565, 290, 120, 0)
g.item('kitchen_counter', -100, 745, 110, 60, 180)
# 用餐區：焗爐矮櫃、矮櫃
g.item('kitchen_counter', 131, 752, 250, 70, 180)
g.item('tv_cabinet', 239, 647, 95, 38, 90)
# 分享區：LED 電視（牆身）、枱椅、雪櫃
g.item('tv', 197, 230, 120, 8, 90)
g.item('meeting', 100, 250, 170, 90, 90)
for y in (195, 300): g.item('chair', 27, y, 50, 50, 90); g.item('chair', 173, y, 50, 50, 270)
g.item('fridge', -38, 185, 60, 65, 270)
# 洗衣區：3 個高櫃（洗衣機＋乾衣機）、高櫃、座位櫃
for y in (592, 668, 744): g.item('laundry_tower', 320, y, 72, 65, 270)
g.item('roomsupply', 574, 566, 220, 35, 90, 200)
g.item('tv_cabinet', 574, 732, 105, 35, 90)
g.item('tv_cabinet', 132, 824, 255, 45, 0); g.item('roomsupply', 310, 824, 90, 45, 0, 200)
# Drop-in 區：長梳化、茶几、椅、層架（書）、按摩椅（EQ7、EQ8）、長枱
g.item('sofa', -220, 838, 350, 70, 0)
for x in (-350, -235, -120): g.item('coffee_table', x, 915, 70, 60, 0); g.item('chair', x, 985, 50, 50, 0)
g.item('rack75', -412, 1130, 450, 32, 270, 185)
g.item('massage_chair', -302, 1105, 61, 114, 270, 65)
g.item('massage_chair', -287, 1232, 76, 176, 270, 79)
for x in (35, 215): g.item('meeting', x, 1183, 178, 95, 0)
for x in (-10, 80, 170, 260): g.item('chair', x, 1108, 50, 50, 180); g.item('chair', x, 1262, 50, 50, 0)
# 接待處、打印機、矮牆、吧枱
g.item('signin', -208, 1365, 150, 75, 90, 105)
g.item('printer', -208, 1492, 40, 70, 0)
g.item('chair', -290, 1380, 50, 50, 90)
g.item('hpart_v', -28, 1487, 65, 8, 90, 100)
for x in (50, 190): g.item('reading_table', x, 1500, 55, 55, 0, 105)
for x in (0, 100, 140, 240): g.item('bar_stool', x, 1500, 38, 38, 0)
g.dump(os.path.join(ROOT, 'data/plan.json'), '地下平面圖：由竣工平面圖（Yuen Fat，2024-06-27，1:100）描繪，單位 cm，約 ±10 cm。x = 0 係 E 軸線，y = 0 係後牆。')

# ================= 一樓 1/F =================
f = Plan()
f.rooms.append({'id': '1f', 'pts': [P(-100,0), P(600,0), P(600,1565), P(-45,1565), P(-45,275), P(-100,275)]})
f.door((-100,275), (-100,0), 10, 115, W)                                     # 西面出口門
# 送餐升降機、天井、空位（唔開放）
f.wall((200,0), (200,260)); f.wall((200,260), (300,260)); f.wall((300,260), (300,470)); f.wall((300,470), (495,470))
f.item('column', 272, 82, 145, 165); f.item('column', 507, 235, 25, 470)
# 儲物室 2、洗手間 4、5、樓梯平台
f.wall((500,470), (500,845))
f.door((500,470), (500,845), 10, 70, E); f.door((500,470), (500,845), 105, 170, E); f.door((500,470), (500,845), 280, 340, E)
f.wall((500,560), (600,560)); f.wall((500,697), (600,697)); f.wall((500,845), (600,845))
# 辦公室／遊戲室、走廊
f.wall((-45,590), (360,590))
f.wall((360,590), (360,1030), glass=True); f.door((360,590), (360,1030), 340, 420, W)   # 實牆＋玻璃；DR-01
f.wall((360,700), (500,700)); f.door((360,700), (500,700), 8, 80, N)                   # 走廊入口 DR-01
f.wall((-45,1030), (360,1030))                                                        # 摺門（Folding partition）
f.wall((360,1030), (475,1030)); f.door((360,1030), (475,1030), 20, 100, S)             # DR-01 入多用途室
# 樓梯西牆（樓梯平台門）、儲物室 3
f.wall((475,845), (475,1565)); f.door((475,845), (475,1565), 15, 90, E); f.door((475,845), (475,1565), 545, 605, E)
f.wall((475,1380), (600,1380))
f.window((-45,1565), (600,1565), 45, 510)
f.item('column', -27, 765, 35, 170); f.item('column', -25, 1540, 40, 50); f.item('column', 575, 1545, 50, 40)
# 辦公室（枱椅由使用者提供）
for (x, y, r) in ((20, 65, 0), (130, 65, 0), (25, 330, 270), (25, 455, 270), (215, 330, 90), (215, 455, 90)):
    f.item('desk', x, y, 100, 60, r)
f.item('printer', 130, 180, 75, 75, 0)
# 多用途室：長枱同 6 張椅
f.item('meeting', 230, 1393, 270, 95, 0)
for x in (140, 230, 320): f.item('chair', x, 1318, 50, 50, 180); f.item('chair', x, 1468, 50, 50, 0)
f.dump(os.path.join(ROOT, 'data/plan-1f.json'), '一樓平面圖：由竣工平面圖（Yuen Fat，2024-06-27，1:100）描繪，單位 cm，約 ±10 cm。x = 0 係 E 軸線，y = 0 係後牆。')
print('G items', len(g.items), 'walls', len(g.walls), '| 1F items', len(f.items), 'walls', len(f.walls))
