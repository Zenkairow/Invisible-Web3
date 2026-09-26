import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getAddresses } from '../config/addresses';
import { logger } from '../utils/logger';

dotenv.config();

const PaymasterABI = [
  "function getHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, uint48 validUntil, uint48 validAfter) view returns (bytes32)"
];

export class SigningService {
  private signer: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private paymasterAddress: string;

  constructor() {
    const pk = process.env.VERIFYING_SIGNER_PRIVATE_KEY;
    if (!pk) throw new Error("VERIFYING_SIGNER_PRIVATE_KEY is missing");
    
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(pk, this.provider);
    
    const addresses = getAddresses();
    this.paymasterAddress = addresses.PAYMASTER_ADDRESS;
  }

  async authorizeUserOp(userOp: any): Promise<string> {
    const validUntil = Math.floor(Date.now() / 1000) + 3600; 
    const validAfter = 0;

    const abiCoder = new ethers.AbiCoder();
    const validityData = abiCoder.encode(["uint48", "uint48"], [validUntil, validAfter]);
    
    const paymasterAndDataWithoutSig = ethers.concat([
      this.paymasterAddress,
      validityData
    ]);

    const dummySignature = "0x" + "00".repeat(65);
    const mockUserOp = { ...userOp, paymasterAndData: ethers.concat([paymasterAndDataWithoutSig, dummySignature]) };

    const paymaster = new ethers.Contract(this.paymasterAddress, PaymasterABI, this.provider);
    const hashToSign = await paymaster.getFunction("getHash")(mockUserOp, validUntil, validAfter);
    
    const signature = await this.signer.signMessage(ethers.getBytes(hashToSign));
    
    logger.info(`Generated Paymaster signature for sender ${userOp.sender}`);
    return ethers.concat([paymasterAndDataWithoutSig, signature]);
  }
}
