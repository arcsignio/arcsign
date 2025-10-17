# 如何生成所有54条链的地址列表

## 快速开始

### 1. 构建程序
```bash
go build -o arcsign ./cmd/arcsign
```

### 2. 运行地址生成命令
```bash
./arcsign generate-all
```

## 完整使用流程

### 步骤 1: 准备 USB 驱动器
- 插入包含钱包的 USB 驱动器
- 确保有足够的空间（至少 1MB）

### 步骤 2: 运行命令
```bash
./arcsign generate-all
```

### 步骤 3: 按照提示操作

```
=== ArcSign - Generate All Addresses ===

Step 1: Detecting USB storage...
✓ USB device detected: /Volumes/YOUR_USB

Step 2: Enter wallet ID: [输入你的钱包ID]

Step 3: Loading wallet...
✓ Wallet found!
  Name: My Wallet

Step 4: Enter encryption password to unlock wallet
Enter password: [输入加密密码]

✓ Wallet unlocked successfully!

Step 5: Generating addresses for all 54 blockchains...
(This will take about 10-15 seconds)

  ✓ Bitcoin (BTC): 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
  ✓ Ethereum (ETH): 0x742d35Cc6634C0532925a3b844Bc9e7595f...
  ✓ Binance Coin (BNB): 0x742d35Cc6634C0532925a3b844Bc9e7595f...
  ... (共54条链)

✓ Generation complete: 54 success, 0 failed

Step 6: Saving address list...
✓ JSON saved: addresses-20251017-143025.json
✓ CSV saved: addresses-20251017-143025.csv

═══════════════════════════════════════════════════════════
                    GENERATION SUMMARY
═══════════════════════════════════════════════════════════

  Total blockchains: 54
  Successfully generated: 54
  Failed: 0

  Output files:
    JSON: addresses-20251017-143025.json
    CSV:  addresses-20251017-143025.csv

  Location: /Volumes/YOUR_USB/wallet-id/addresses/

═══════════════════════════════════════════════════════════

✓ All addresses have been saved to USB drive!
```

## 输出文件

### 文件位置
```
USB驱动器/
└── {wallet-id}/
    └── addresses/
        ├── addresses-20251017-143025.json
        └── addresses-20251017-143025.csv
```

### JSON 文件格式
```json
{
  "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
  "wallet_name": "My Wallet",
  "generated_at": "2025-10-17T14:30:25+08:00",
  "total_chains": 54,
  "success_count": 54,
  "failed_count": 0,
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "coin_type": 0,
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "path": "m/44'/0'/0'/0/0",
      "category": "base",
      "key_type": "secp256k1"
    },
    {
      "rank": 2,
      "symbol": "ETH",
      "name": "Ethereum",
      "coin_type": 60,
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "path": "m/44'/60'/0'/0/0",
      "category": "base",
      "key_type": "secp256k1"
    }
    // ... 52 more chains
  ]
}
```

### CSV 文件格式
```csv
Rank,Symbol,Name,Category,Coin Type,Key Type,Derivation Path,Address,Error
1,BTC,Bitcoin,base,0,secp256k1,m/44'/0'/0'/0/0,1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,
2,ETH,Ethereum,base,60,secp256k1,m/44'/60'/0'/0/0,0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,
...
```

## 支持的54条区块链

### 按类别分组

**30条基础链 (v0.2.0)**:
- BTC, ETH, USDT, BNB, SOL, USDC, XRP, DOGE, ADA, TRX
- AVAX, SHIB, DOT, LINK, MATIC, LTC, BCH, XLM, UNI, ATOM
- ETC, XMR, FIL, HBAR, APT, VET, ALGO, NEAR, ZEC, DASH

**6条Layer 2网络 (v0.3.0 Phase 1)**:
- ARB (Arbitrum)
- OP (Optimism)
- BASE (Base)
- ZKS (zkSync)
- LINEA (Linea)
- STRK (Starknet)

**4条区域链 (v0.3.0 Phase 2)**:
- KLAY (Klaytn)
- CRO (Cronos)
- HT (HECO)
- ONE (Harmony)

**4条Cosmos生态 (v0.3.0 Phase 3)**:
- OSMO (Osmosis)
- JUNO (Juno)
- EVMOS (Evmos)
- SCRT (Secret Network)

**6条替代EVM链 (v0.3.0 Phase 4)**:
- FTM (Fantom)
- CELO (Celo)
- GLMR (Moonbeam)
- METIS (Metis)
- GNO (Gnosis)
- WAN (Wanchain)

**4条专业链 (v0.3.0 Phase 5)**:
- KSM (Kusama) - sr25519签名
- ICX (ICON) - SHA3-256哈希
- XTZ (Tezos) - Ed25519 + SLIP-10
- ZIL (Zilliqa) - Schnorr签名

## 使用场景

### 1. 创建地址记录簿
将CSV文件导入Excel或Google Sheets，创建完整的地址记录。

### 2. 备份所有地址
将JSON文件存储在安全位置，作为地址的完整备份。

### 3. 批量导入到其他工具
使用JSON或CSV文件将地址批量导入到：
- 投资组合追踪工具
- 税务计算软件
- 区块链浏览器监控

### 4. 打印纸质备份
打印CSV文件作为离线备份。

## 安全提示

⚠️ **重要安全建议**:

1. **文件权限**: 地址文件自动设置为 0600 权限（仅所有者可读写）
2. **USB存储**: 文件仅保存在USB驱动器上，不在电脑硬盘
3. **地址隐私**: 虽然地址可以公开，但一次性暴露所有地址可能会影响隐私
4. **保护密码**: 永远不要在地址文件中包含私钥或助记词
5. **安全环境**: 在安全的环境中生成和存储地址列表

## 高级用法

### 查看特定类别的地址

使用 `jq` 工具过滤JSON文件：

```bash
# 查看所有Layer 2地址
jq '.addresses[] | select(.category == "layer2")' addresses-*.json

# 查看所有Ed25519签名的链
jq '.addresses[] | select(.key_type == "ed25519")' addresses-*.json

# 查看前10条链
jq '.addresses[:10]' addresses-*.json
```

### 在Excel中处理CSV

1. 打开CSV文件
2. 使用"数据">"筛选"功能
3. 按 Category 列分组
4. 按 Rank 列排序

### 编程方式读取

**Python示例**:
```python
import json

# 读取JSON文件
with open('addresses-20251017-143025.json', 'r') as f:
    data = json.load(f)

# 打印所有比特币系地址
for addr in data['addresses']:
    if 'bitcoin' in addr['name'].lower():
        print(f"{addr['symbol']}: {addr['address']}")
```

**JavaScript示例**:
```javascript
const fs = require('fs');

// 读取JSON文件
const data = JSON.parse(fs.readFileSync('addresses-20251017-143025.json'));

// 按市值排序
const sorted = data.addresses.sort((a, b) => a.rank - b.rank);

// 打印前5名
sorted.slice(0, 5).forEach(addr => {
    console.log(`${addr.rank}. ${addr.name} (${addr.symbol}): ${addr.address}`);
});
```

## 故障排除

### 问题: USB驱动器未检测到
**解决方案**:
- 确保USB驱动器已正确插入
- 检查USB驱动器是否已挂载
- 尝试其他USB端口

### 问题: 钱包ID错误
**解决方案**:
- 检查USB驱动器上的钱包目录名称
- 钱包ID是UUID格式（例如：3c3e0aba-91e1-44d4-8b29-ec066d5acf0b）
- 确保使用正确的USB驱动器

### 问题: 密码错误
**解决方案**:
- 确认输入的是钱包加密密码（不是BIP39助记词密码）
- 检查大小写锁定键
- 等待1分钟后重试（速率限制）

### 问题: 某些链生成失败
**解决方案**:
- 查看CSV的Error列了解失败原因
- 大多数链应该成功（预期54/54成功）
- 如果多个链失败，请检查依赖项是否完整安装

## 命令参考

```bash
# 显示帮助
./arcsign help

# 创建新钱包
./arcsign create

# 恢复钱包
./arcsign restore

# 生成单个地址
./arcsign derive

# 生成所有54条链的地址（新功能！）
./arcsign generate-all

# 显示版本
./arcsign version
```

## 技术细节

### 地址派生路径
所有地址使用BIP44标准路径：
```
m/44'/coin_type'/0'/0/0
```
- m: 主密钥
- 44': BIP44标准（硬化）
- coin_type': SLIP-44币种类型（硬化）
- 0': 账户索引（硬化）
- 0: 外部链（接收地址）
- 0: 地址索引

### 支持的签名方案
1. **ECDSA (secp256k1)**: 大多数链（BTC, ETH, 等）
2. **Ed25519**: Solana, Tezos
3. **sr25519**: Kusama (Substrate)
4. **Schnorr**: Zilliqa

### 地址格式
- **P2PKH**: Bitcoin及兼容链 (1...)
- **Keccak256**: Ethereum及EVM链 (0x...)
- **Bech32**: Cosmos生态, Harmony, Zilliqa (prefix1...)
- **SS58**: Kusama (字母开头)
- **SHA3-256**: ICON (hx...)
- **Blake2b**: Tezos (tz1...)

## 更新日志

### v0.3.0 (2025-10-17)
- ✅ 新增 `generate-all` 命令
- ✅ 支持54条区块链
- ✅ JSON和CSV双格式导出
- ✅ 实时进度显示
- ✅ 完整的元数据记录

---

**版本**: v0.3.0
**更新日期**: 2025-10-17
**文档**: GENERATE_ALL_GUIDE.md
