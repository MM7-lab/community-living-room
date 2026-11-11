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
g.wall((475,1295), (475,1455))                                               # 吸音板牆（樓梯底）；北面係健身角入口
g.wall((298,1455), (475,1455)); g.door((298,1455), (475,1455), 50, 147, S)   # DR-05：大門口入地下（新設計）
g.wall((298,1455), (298,1575), glass=True)                                   # 大門口西面玻璃間隔（現場相片）
g.item('handrail', 332, 1395, 110, 6, 90)                                  # 不鏽鋼扶手
g.item('platform', 404, 1376, 118, 142, 0)                                 # 大門口入嚟嘅兩級台階（3D 當平地行）
# 前面：窗、側門（DR-04）、大門口
g.window((-437,1575), (600,1575), 17, 277)                                   # x -420..-160
g.door(*FRONT, 651, 755, N)                                                  # DR-04（x -155..-51）
g.window((-437,1575), (600,1575), 437, 772)                                  # 玻璃 x 0..335
g.door(*FRONT, 10, 250, N, 'door2')                                          # 大門口 x 350..590
g.item('column', -425, 1550, 30, 50)
g.wall((-165,1440), (-165,1575)); g.item('column', -32, 1509, 36, 128)        # 側門斜台兩邊（新設計）
# 教學區：煮食爐同洗手盆（左牆、頂）、教學工作枱
for y in (365, 535, 705): g.item('kitchen_counter', -398, y, 168, 60, 270)
g.item('steel_sink', -90, 284, 150, 60, 0)                                   # 不鏽鋼盆枱（現場相片）
g.item('steel_table', -215, 284, 60, 55, 0); g.item('pedal_bin', -268, 285, 30, 30)   # 矮枱（電飯煲）、垃圾桶
g.item('wall_oven', -215, 276, 70, 55, 0)                                   # 牆架蒸櫃
g.item('wall_clock', -130, 254, 30, 4, 0); g.item('utensil_rail', -428, 535, 480, 3, 270)
g.item('hood', -403, 535, 510, 60, 270)                                     # 抽油煙罩
g.item('island', -130, 565, 290, 120, 0)                                    # 不鏽鋼中島（東面有枱下雪櫃）
g.item('island_riser', -130, 565, 120, 32, 0); g.item('rice_cooker', -40, 590, 28, 28)
g.item('counter', -175, 745, 250, 60, 180); g.item('hob', -150, 745, 58, 50, 180)    # 橙色玻璃窗下面：工作枱＋電磁爐
g.item('fridge_black', -335, 748, 60, 62, 180); g.item('orange_window', -225, 795, 240, 10, 0)
# 用餐區：焗爐矮櫃、矮櫃
g.item('counter', 131, 752, 250, 70, 180); g.item('oven_black', 45, 757, 58, 45, 180); g.item('steam_oven', 115, 757, 48, 40, 180)
g.item('tv_cabinet', 239, 647, 95, 38, 90)
# 分享區：LED 電視（牆身）、枱椅、雪櫃
g.item('tv', 197, 230, 120, 8, 90)
g.item('meeting', 100, 250, 170, 90, 90)
for y in (195, 300): g.item('chair', 27, y, 50, 50, 90); g.item('chair', 173, y, 50, 50, 270)
g.item('fridge4', -37, 185, 120, 68, 270, 200)                              # 四門不鏽鋼雪櫃
# 洗衣區：3 個高櫃（洗衣機＋乾衣機）、高櫃
for y in (592, 668, 744): g.item('laundry_tower', 320, y, 72, 65, 270)
g.item('roomsupply', 574, 566, 220, 35, 90, 200)
g.item('pay_kiosk', 361, 821, 35, 8, 270)                                  # 洗衣付款機（高櫃側面）
g.item('bench', 566, 735, 96, 50, 90)                                       # 健康站旁軟墊長櫈
g.wall((263,795), (355,795))                                                 # 洗衣區前面（新設計）

# ---- 以下按新設計圖（廚房外面，2026-08）描繪，約 ±20 cm ----
# 廚房外：矮櫃、兩個高櫃
g.item('tv_cabinet', 100, 820, 196, 40, 0, 90)
for x in (239, 318): g.item('roomsupply', x, 821, 78, 42, 0, 200)
# 左牆：牆柱、書櫃、高櫃
g.item('column', -421, 853, 28, 115)
g.item('white_cabinet', -411, 1080, 330, 33, 270, 240)                      # 白色高櫃（現場相片）
g.item('orange_arch', -393, 880, 110, 2, 270); g.item('mirror_niche', -393, 1010, 55, 2, 270)
g.item('roomsupply', -411, 1386, 270, 33, 270, 200)
# 遊戲區旁嘅植物間隔
g.item('slat_wall', -271, 801, 330, 4, 0)                                   # 遊戲區北面木條牆＋鏡面窗
# ---- 大廳：按現場相片（2026-11）調整 ----
# 北面木櫃牆：嵌入式大電視（矮櫃上面）、柱身自助服務機
g.item('tv', 100, 804, 185, 6, 0, 105)
g.item('kiosk_wall', -45, 846, 90, 10, 0, 240)                             # 木牆身：自助服務機、飲水機、鐘
g.item('tv_niche', 100, 800, 210, 2, 0, 138)                               # 電視藍灰色凹位
g.item('upper_wood', 100, 820, 200, 40, 0, 38)                             # 電視上面木吊櫃
# 休閒區：梳化對住大電視，旁邊細梳化，地氈同兩張白色圓几
g.item('rug', 150, 945, 300, 190, 0, 1)
g.item('sofa', 135, 1062, 280, 85, 180)                                     # 啡色四座位長梳化（向電視）
g.item('loveseat', 358, 925, 140, 80, 90)                                   # 灰色布細梳化（向西）
g.item('reading_table', 150, 915, 60, 60, 0, 45); g.item('reading_table', 195, 975, 55, 55, 0, 45)
# 用餐區：兩張木餐枱（橫放），每張 6 張椅
for (tx, ty) in ((45, 1205), (248, 1340)):
    g.item('dining_table', tx, ty, 150, 80, 0)
    for dx in (-55, 0, 55): g.item('chair', tx + dx, ty - 64, 45, 45, 180); g.item('chair', tx + dx, ty + 64, 45, 45, 0)
# 黑色格柵天花同圓形吊燈（淨係完整牆身先見）
g.item('baffle_ceiling', 19, 1128, 912, 655, 0)
for (x, y, dm) in ((110, 950, 130), (110, 1250, 110), (-150, 1150, 90), (340, 1040, 70), (420, 1260, 60), (60, 1420, 100)):
    g.item('ring_light', x, y, dm, dm, 0)
# 接待處：L 形枱、兩張椅
g.item('signin', -216, 1411, 177, 80, 90, 105)
for y in (1383, 1464): g.item('chair', -291, y, 50, 50, 90)
# 按摩及健身區：綠色吊櫃、拱門屏風；儲物室外牆吸音板
g.item('upper_cabinet', 575, 860, 300, 35, 90)
g.item('pad_wall', 588, 1240, 110, 6, 90)                                    # 健身角綠色軟墊牆
g.item('arch_partition', 470, 1130, 110, 12, 90)                            # 圓鏡屏風
for y in (1218, 1268): g.item('dumbbell_rack', 562, y, 48, 50, 90)          # 健身角（樓梯底凹位）
g.item('acoustic_green', 469, 1335, 85, 3, 90); g.item('acoustic_blue', 469, 1400, 85, 3, 90)
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
# 辦公室唔對外開放：唔畫傢俬。兩間活動室嘅擺設喺 data/center.json（自修室、自由空間）。
f.dump(os.path.join(ROOT, 'data/plan-1f.json'), '一樓平面圖：由竣工平面圖（Yuen Fat，2024-06-27，1:100）描繪，單位 cm，約 ±10 cm。x = 0 係 E 軸線，y = 0 係後牆。')
print('G items', len(g.items), 'walls', len(g.walls), '| 1F items', len(f.items), 'walls', len(f.walls))
