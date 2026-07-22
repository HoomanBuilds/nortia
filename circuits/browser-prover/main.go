package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"syscall/js"

	"github.com/consensys/gnark-crypto/ecc"
	bn254curve "github.com/consensys/gnark-crypto/ecc/bn254"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/constraint"
	"github.com/reilabs/sunspot/go/acir"
	"github.com/reilabs/sunspot/go/bn254"
)

func bytesFromJS(value js.Value) []byte {
	result := make([]byte, value.Get("byteLength").Int())
	js.CopyBytesToGo(result, value)
	return result
}

func bytesToJS(value []byte) js.Value {
	result := js.Global().Get("Uint8Array").New(len(value))
	js.CopyBytesToJS(result, value)
	return result
}

func prove(acirBytes, witnessBytes, ccsBytes, pkBytes []byte) ([]byte, []byte, error) {
	type E = constraint.U64
	type T = *bn254.BN254Field
	var program acir.ACIR[T, E]
	if err := json.Unmarshal(acirBytes, &program); err != nil {
		return nil, nil, fmt.Errorf("decode ACIR: %w", err)
	}
	ccs := groth16.NewCS(ecc.BN254)
	if _, err := ccs.ReadFrom(bytes.NewReader(ccsBytes)); err != nil {
		return nil, nil, fmt.Errorf("decode CCS: %w", err)
	}
	pk := groth16.NewProvingKey(ecc.BN254)
	if _, err := pk.ReadFrom(bytes.NewReader(pkBytes)); err != nil {
		return nil, nil, fmt.Errorf("decode proving key: %w", err)
	}
	witness, err := program.GetWitnessBytes(witnessBytes, bn254curve.ID.ScalarField())
	if err != nil {
		return nil, nil, err
	}
	proof, err := groth16.Prove(ccs, pk, witness)
	if err != nil {
		return nil, nil, fmt.Errorf("prove: %w", err)
	}
	var proofBytes bytes.Buffer
	if _, err := proof.WriteRawTo(&proofBytes); err != nil {
		return nil, nil, fmt.Errorf("encode proof: %w", err)
	}
	publicWitness, err := witness.Public()
	if err != nil {
		return nil, nil, fmt.Errorf("public witness: %w", err)
	}
	var publicBytes bytes.Buffer
	if _, err := publicWitness.WriteTo(&publicBytes); err != nil {
		return nil, nil, fmt.Errorf("encode public witness: %w", err)
	}
	return proofBytes.Bytes(), publicBytes.Bytes(), nil
}

func main() {
	handler := js.FuncOf(func(this js.Value, args []js.Value) any {
		result := js.Global().Get("Object").New()
		if len(args) != 4 {
			result.Set("error", "expected ACIR, witness, CCS, and proving key")
			return result
		}
		proof, publicWitness, err := prove(
			bytesFromJS(args[0]),
			bytesFromJS(args[1]),
			bytesFromJS(args[2]),
			bytesFromJS(args[3]),
		)
		if err != nil {
			result.Set("error", err.Error())
			return result
		}
		result.Set("proof", bytesToJS(proof))
		result.Set("publicWitness", bytesToJS(publicWitness))
		return result
	})
	js.Global().Set("nortiaSunspotProve", handler)
	select {}
}
