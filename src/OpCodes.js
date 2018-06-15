let Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

function hex(num, size = 2){
	return '$' + Address.format(num, size);
}

function bankStr( index ){
	return Address.toBankString( index, 'rom' );
}

function empty( str ){
	return {
		size : 0,
		handler : () => str
	}
}

function single( str ){
	return {
		size : 1,
		handler : x => str.replace('_', hex(x) )
	}
}

function db( x ){
	let str = 'db ' + hex(x);
	
	return {
		size : 0,
		handler : ( val, bank_start, index ) => {
			Warning("Non-opcode '" + str + "' parsed at " + bankStr(index) );
			return str;
		}
	}
}

function cb(){
	return {
		size : 1,
		handler : x => CB_OpCodes[x]
	}
}

function jr( str ){
	return {
		size : 1,
		handler( val, bank_start, index ){
			let offset = (val <= 127 ? val : -256 + val),
				addr = index + 2 + offset,
				type = 'rom';
			
			// If it shifted backwards, see if points to a different bank
			if( offset < 0 ){
				// If the new address is less than 0, then just return the number with a warning
				if( addr < 0 ){
					Warning("Opcode 'jr " + hex(val) + "' at " + bankStr(index) + " points to a RAM value");
					Warning('Reference to $' + Address.format(0x10000 - addr, 4) + ' at' + bankStr(index) + ' will not be considered a Pointer' );
					
					return str.replace('_', hex(val) );
				}
				// If it shifted outside the bank, then convert it to the home bank
				else if( addr < bank_start ){
					Warning("Opcode 'jr " + hex(val) + "' at " + bankStr(index) + " points to the home bank");
						
					// Adjust the address to be in the home bank
					addr %= 0x4000;
				}
			}
			// If it shifted forwards into a different bank:
			else if( addr % 0x4000 < index % 0x4000 ){
				// If the jr is in the home bank:
				if( index < 0x4000 ){
					
					// If the home ref bank isn't 0, then adjust the address
					if( bank_start ){
						Warning("Opcode 'jr " + hex(val) + "' at " + bankStr(index) + " points to the switchable bank");
					
						addr = bank_start + (addr % 0x4000);
					}
					// Otherwise, store is as a number
					else{
						Warning("Opcode 'jr " + hex(val) + "' at " + bankStr(index) + " points to the switchable bank.");
						Warning('Reference to $' + Address.format(0x4000 + (addr % 0x4000), 4) + ' at ' + bankStr(index) + ' will not be considered a Pointer' );
						
						return str.replace( '_', hex(val) );
					}
				}
				// Otherwise, the new address is in RAM
				else{
					Warning("Opcode 'jr " + hex(val) + "' at " + bankStr(index) + " points to a RAM value");
					addr -= (bank_start - 0x4000)
					type = 'ram';
				}
			}
			
			return {
				addr : { addr, type },
				str : str,
				type : Ref.EXEC
			};
		}
	}
}

function ff( str ){
	return {
		size : 1,
		handler( val ){
			return {
				addr : { addr : 0xFF00 + val, type : 'ram' },
				str : str,
				type : Ref.DATA,
			}
		}
	}
}

function ref( str, type ){
	return {
		size : 2,
		handler: (val, bank_start, index) => {
			let addr = Address.getAddr( bank_start, val );
			// If the addr is outside the home bank, and called from the home bank without a homeRefBank set, then return a fixed number
			if( !bank_start && addr.type ==='rom' && addr.addr >= 0x4000 ){
				Warning('Reference to $' + Address.format(val, 4) + ' at ' + bankStr(index) + ' will not be considered a Pointer' )
				return str.replace('_', hex(val, 4) );
			}
			else{
				return { addr, str, type };
			}
		}
	}
}

let OpCodes = [
	empty('nop'),		// 0x00
	ref('ld bc, _', Ref.MAYBE),		// 0x01
	empty('ld [bc], a'),		// 0x02
	empty('inc bc'),		// 0x03
	empty('inc b'),		// 0x04
	empty('dec b'),		// 0x05
	single('ld b, _'),		// 0x06
	empty('rlca'),		// 0x07
	ref('ld [_], sp', Ref.DATA),		// 0x08
	empty('add hl, bc'),		// 0x09
	empty('ld a, [bc]'),		// 0x0A
	empty('dec bc'),		// 0x0B
	empty('inc c'),		// 0x0C
	empty('dec c'),		// 0x0D
	single('ld c, _'),		// 0x0E
	empty('rrca'),		// 0x0F
	db(0x10),
	ref('ld de, _', Ref.MAYBE),		// 0x11
	empty('ld [de], a'),		// 0x12
	empty('inc de'),		// 0x13
	empty('inc d'),		// 0x14
	empty('dec d'),		// 0x15
	single('ld d, _'),		// 0x16
	empty('rla'),		// 0x17
	jr('jr _'),		// 0x18
	empty('add hl, de'),		// 0x19
	empty('ld a, [de]'),		// 0x1A
	empty('dec de'),		// 0x1B
	empty('inc e'),		// 0x1C
	empty('dec e'),		// 0x1D
	single('ld e, _'),		// 0x1E
	empty('rra'),		// 0x1F
	jr('jr nz, _'),		// 0x20
	ref('ld hl, _', Ref.MAYBE),		// 0x21
	empty('ld [hli], a'),		// 0x22
	empty('inc hl'),		// 0x23
	empty('inc h'),		// 0x24
	empty('dec h'),		// 0x25
	single('ld h, _'),		// 0x26
	empty('daa'),		// 0x27
	jr('jr z, _'),		// 0x28
	empty('add hl, hl'),		// 0x29
	empty('ld a, [hli]'),		// 0x2A
	empty('dec hl'),		// 0x2B
	empty('inc l'),		// 0x2C
	empty('dec l'),		// 0x2D
	single('ld l, _'),		// 0x2E
	empty('cpl'),		// 0x2F
	jr('jr nc, _'),		// 0x30
	ref('ld sp, _', Ref.DATA),		// 0x31
	empty('ld [hld], a'),		// 0x32
	empty('inc sp'),		// 0x33
	empty('inc [hl]'),		// 0x34
	empty('dec [hl]'),		// 0x35
	single('ld [hl], _'),		// 0x36
	empty('scf'),		// 0x37
	jr('jr c, _'),		// 0x38
	empty('add hl, sp'),		// 0x39
	empty('ld a, [hld]'),		// 0x3A
	empty('dec sp'),		// 0x3B
	empty('inc a'),		// 0x3C
	empty('dec a'),		// 0x3D
	single('ld a, _'),		// 0x3E
	empty('ccf'),		// 0x3F
	empty('ld b, b'),		// 0x40
	empty('ld b, c'),		// 0x41
	empty('ld b, d'),		// 0x42
	empty('ld b, e'),		// 0x43
	empty('ld b, h'),		// 0x44
	empty('ld b, l'),		// 0x45
	empty('ld b, [hl]'),		// 0x46
	empty('ld b, a'),		// 0x47
	empty('ld c, b'),		// 0x48
	empty('ld c, c'),		// 0x49
	empty('ld c, d'),		// 0x4A
	empty('ld c, e'),		// 0x4B
	empty('ld c, h'),		// 0x4C
	empty('ld c, l'),		// 0x4D
	empty('ld c, [hl]'),		// 0x4E
	empty('ld c, a'),		// 0x4F
	empty('ld d, b'),		// 0x50
	empty('ld d, c'),		// 0x51
	empty('ld d, d'),		// 0x52
	empty('ld d, e'),		// 0x53
	empty('ld d, h'),		// 0x54
	empty('ld d, l'),		// 0x55
	empty('ld d, [hl]'),		// 0x56
	empty('ld d, a'),		// 0x57
	empty('ld e, b'),		// 0x58
	empty('ld e, c'),		// 0x59
	empty('ld e, d'),		// 0x5A
	empty('ld e, e'),		// 0x5B
	empty('ld e, h'),		// 0x5C
	empty('ld e, l'),		// 0x5D
	empty('ld e, [hl]'),		// 0x5E
	empty('ld e, a'),		// 0x5F
	empty('ld h, b'),		// 0x60
	empty('ld h, c'),		// 0x61
	empty('ld h, d'),		// 0x62
	empty('ld h, e'),		// 0x63
	empty('ld h, h'),		// 0x64
	empty('ld h, l'),		// 0x65
	empty('ld h, [hl]'),		// 0x66
	empty('ld h, a'),		// 0x67
	empty('ld l, b'),		// 0x68
	empty('ld l, c'),		// 0x69
	empty('ld l, d'),		// 0x6A
	empty('ld l, e'),		// 0x6B
	empty('ld l, h'),		// 0x6C
	empty('ld l, l'),		// 0x6D
	empty('ld l, [hl]'),		// 0x6E
	empty('ld l, a'),		// 0x6F
	empty('ld [hl], b'),		// 0x70
	empty('ld [hl], c'),		// 0x71
	empty('ld [hl], d'),		// 0x72
	empty('ld [hl], e'),		// 0x73
	empty('ld [hl], h'),		// 0x74
	empty('ld [hl], l'),		// 0x75
	empty('halt'),		// 0x76
	empty('ld [hl], a'),		// 0x77
	empty('ld a, b'),		// 0x78
	empty('ld a, c'),		// 0x79
	empty('ld a, d'),		// 0x7A
	empty('ld a, e'),		// 0x7B
	empty('ld a, h'),		// 0x7C
	empty('ld a, l'),		// 0x7D
	empty('ld a, [hl]'),		// 0x7E
	empty('ld a, a'),		// 0x7F
	empty('add b'),		// 0x80
	empty('add c'),		// 0x81
	empty('add d'),		// 0x82
	empty('add e'),		// 0x83
	empty('add h'),		// 0x84
	empty('add l'),		// 0x85
	empty('add [hl]'),		// 0x86
	empty('add a'),		// 0x87
	empty('adc b'),		// 0x88
	empty('adc c'),		// 0x89
	empty('adc d'),		// 0x8A
	empty('adc e'),		// 0x8B
	empty('adc h'),		// 0x8C
	empty('adc l'),		// 0x8D
	empty('adc [hl]'),		// 0x8E
	empty('adc a'),		// 0x8F
	empty('sub b'),		// 0x90
	empty('sub c'),		// 0x91
	empty('sub d'),		// 0x92
	empty('sub e'),		// 0x93
	empty('sub h'),		// 0x94
	empty('sub l'),		// 0x95
	empty('sub [hl]'),		// 0x96
	empty('sub a'),		// 0x97
	empty('sbc b'),		// 0x98
	empty('sbc c'),		// 0x99
	empty('sbc d'),		// 0x9A
	empty('sbc e'),		// 0x9B
	empty('sbc h'),		// 0x9C
	empty('sbc l'),		// 0x9D
	empty('sbc [hl]'),		// 0x9E
	empty('sbc a'),		// 0x9F
	empty('and b'),		// 0xA0
	empty('and c'),		// 0xA1
	empty('and d'),		// 0xA2
	empty('and e'),		// 0xA3
	empty('and h'),		// 0xA4
	empty('and l'),		// 0xA5
	empty('and [hl]'),		// 0xA6
	empty('and a'),		// 0xA7
	empty('xor b'),		// 0xA8
	empty('xor c'),		// 0xA9
	empty('xor d'),		// 0xAA
	empty('xor e'),		// 0xAB
	empty('xor h'),		// 0xAC
	empty('xor l'),		// 0xAD
	empty('xor [hl]'),		// 0xAE
	empty('xor a'),		// 0xAF
	empty('or b'),		// 0xB0
	empty('or c'),		// 0xB1
	empty('or d'),		// 0xB2
	empty('or e'),		// 0xB3
	empty('or h'),		// 0xB4
	empty('or l'),		// 0xB5
	empty('or [hl]'),		// 0xB6
	empty('or a'),		// 0xB7
	empty('cp b'),		// 0xB8
	empty('cp c'),		// 0xB9
	empty('cp d'),		// 0xBA
	empty('cp e'),		// 0xBB
	empty('cp h'),		// 0xBC
	empty('cp l'),		// 0xBD
	empty('cp [hl]'),		// 0xBE
	empty('cp a'),		// 0xBF
	empty('ret nz'),		// 0xC0
	empty('pop bc'),		// 0xC1
	ref('jp nz, _', Ref.EXEC),		// 0xC2
	ref('jp _', Ref.EXEC),		// 0xC3
	ref('call nz, _', Ref.EXEC),		// 0xC4
	empty('push bc'),		// 0xC5
	single('add _'),		// 0xC6
	empty('rst $0'),		// 0xC7
	empty('ret z'),		// 0xC8
	empty('ret'),		// 0xC9
	ref('jp z, _', Ref.EXEC),		// 0xCA
	cb(),		// 0xCB
	ref('call z, _', Ref.EXEC),		// 0xCC
	ref('call _', Ref.EXEC),		// 0xCD
	single('adc _'),		// 0xCE
	empty('rst $8'),		// 0xCF
	empty('ret nc'),		// 0xD0
	empty('pop de'),		// 0xD1
	ref('jp nc, _', Ref.EXEC),		// 0xD2
	db(0xD3),
	ref('call nc, _', Ref.EXEC),		// 0xD4
	empty('push de'),		// 0xD5
	single('sub _'),		// 0xD6
	empty('rst $10'),		// 0xD7
	empty('ret c'),		// 0xD8
	empty('reti'),		// 0xD9
	ref('jp c, _', Ref.EXEC),		// 0xDA
	db(0xDB),
	ref('call c, _', Ref.EXEC),		// 0xDC
	db(0xDD),
	single('sbc _'),		// 0xDE
	empty('rst $18'),		// 0xDF
	ff('ldh [_], a'),		// 0xE0
	empty('pop hl'),		// 0xE1
	empty('ld [$ff00+c], a'),		// 0xE2
	db(0xE3),
	db(0xE4),
	empty('push hl'),		// 0xE5
	single('and _'),		// 0xE6
	empty('rst $20'),		// 0xE7
	single('add sp, _'),		// 0xE8
	empty('jp [hl]'),		// 0xE9
	ref('ld [_], a', Ref.DATA),		// 0xEA
	db(0xEB),
	db(0xEC),
	db(0xED),
	single('xor _'),		// 0xEE
	empty('rst $28'),		// 0xEF
	ff('ldh a, [_]'),		// 0xF0
	empty('pop af'),		// 0xF1
	db(0xF2),
	empty('di'),		// 0xF3
	db(0xF4),
	empty('push af'),		// 0xF5
	single('or _'),		// 0xF6
	empty('rst $30'),		// 0xF7
	single('ld hl, sp+_'),		// 0xF8
	empty('ld sp, [hl]'),		// 0xF9
	ref('ld a, [_]', Ref.DATA),		// 0xFA
	empty('ei'),		// 0xFB
	db(0xFC),
	db(0xFD),
	single('cp _'),		// 0xFE
	empty('rst $38')		// 0xFF
];

let CB_OpCodes = [
	'rlc b',		// 0x00
	'rlc c',		// 0x01
	'rlc d',		// 0x02
	'rlc e',		// 0x03
	'rlc h',		// 0x04
	'rlc l',		// 0x05
	'rlc [hl]',		// 0x06
	'rlc a',		// 0x07 (repeat)
	'rrc b',		// 0x08
	'rrc c',		// 0x09
	'rrc d',		// 0x0A
	'rrc e',		// 0x0B
	'rrc h',		// 0x0C
	'rrc l',		// 0x0D
	'rrc [hl]',		// 0x0E
	'rrc a',		// 0x0F	(repeat)
	'rl b',			// 0x10
	'rl c',			// 0x11
	'rl d',			// 0x12
	'rl e',			// 0x13
	'rl h',			// 0x14
	'rl l',			// 0x15
	'rl [hl]',		// 0x16
	'rl a',			// 0x17 (repeat)
	'rr b',			// 0x18
	'rr c',			// 0x19
	'rr d',			// 0x1A
	'rr e',			// 0x1B
	'rr h',			// 0x1C
	'rr l',			// 0x1D
	'rr [hl]',		// 0x1E
	'rr a',			// 0x1F (repeat)
	'sla b',		// 0x20
	'sla c',		// 0x21
	'sla d',		// 0x22
	'sla e',		// 0x23
	'sla h',		// 0x24
	'sla l',		// 0x25
	'sla [hl]',		// 0x26
	'sla a',		// 0x27
	'sra b',		// 0x28
	'sra c',		// 0x29
	'sra d',		// 0x2A
	'sra e',		// 0x2B
	'sra h',		// 0x2C
	'sra l',		// 0x2D
	'sra [hl]',		// 0x2E
	'sra a',		// 0x2F
	'swap b',		// 0x30
	'swap c',		// 0x31
	'swap d',		// 0x32
	'swap e',		// 0x33
	'swap h',		// 0x34
	'swap l',		// 0x35
	'swap [hl]',	// 0x36
	'swap a',		// 0x37
	'srl b',		// 0x38
	'srl c',		// 0x39
	'srl d',		// 0x3A
	'srl e',		// 0x3B
	'srl h',		// 0x3C
	'srl l',		// 0x3D
	'srl [hl]',		// 0x3E
	'srl a',		// 0x3F
	'bit 0, b',		// 0x40
	'bit 0, c',		// 0x41
	'bit 0, d',		// 0x42
	'bit 0, e',		// 0x43
	'bit 0, h',		// 0x44
	'bit 0, l',		// 0x45
	'bit 0, [hl]',	// 0x46
	'bit 0, a',		// 0x47
	'bit 1, b',		// 0x48
	'bit 1, c',		// 0x49
	'bit 1, d',		// 0x4A
	'bit 1, e',		// 0x4B
	'bit 1, h',		// 0x4C
	'bit 1, l',		// 0x4D
	'bit 1, [hl]',	// 0x4E
	'bit 1, a',		// 0x4F
	'bit 2, b',		// 0x50
	'bit 2, c',		// 0x51
	'bit 2, d',		// 0x52
	'bit 2, e',		// 0x53
	'bit 2, h',		// 0x54
	'bit 2, l',		// 0x55
	'bit 2, [hl]',	// 0x56
	'bit 2, a',		// 0x57
	'bit 3, b',		// 0x58
	'bit 3, c',		// 0x59
	'bit 3, d',		// 0x5A
	'bit 3, e',		// 0x5B
	'bit 3, h',		// 0x5C
	'bit 3, l',		// 0x5D
	'bit 3, [hl]',	// 0x5E
	'bit 3, a',		// 0x5F
	'bit 4, b',		// 0x60
	'bit 4, c',		// 0x61
	'bit 4, d',		// 0x62
	'bit 4, e',		// 0x63
	'bit 4, h',		// 0x64
	'bit 4, l',		// 0x65
	'bit 4, [hl]',	// 0x66
	'bit 4, a',		// 0x67
	'bit 5, b',		// 0x68
	'bit 5, c',		// 0x69
	'bit 5, d',		// 0x6A
	'bit 5, e',		// 0x6B
	'bit 5, h',		// 0x6C
	'bit 5, l',		// 0x6D
	'bit 5, [hl]',	// 0x6E
	'bit 5, a',		// 0x6F
	'bit 6, b',		// 0x70
	'bit 6, c',		// 0x71
	'bit 6, d',		// 0x72
	'bit 6, e',		// 0x73
	'bit 6, h',		// 0x74
	'bit 6, l',		// 0x75
	'bit 6, [hl]',	// 0x76
	'bit 6, a',		// 0x77
	'bit 7, b',		// 0x78
	'bit 7, c',		// 0x79
	'bit 7, d',		// 0x7A
	'bit 7, e',		// 0x7B
	'bit 7, h',		// 0x7C
	'bit 7, l',		// 0x7D
	'bit 7, [hl]',	// 0x7E
	'bit 7, a',		// 0x7F
	'res 0, b',		// 0x80
	'res 0, c',		// 0x81
	'res 0, d',		// 0x82
	'res 0, e',		// 0x83
	'res 0, h',		// 0x84
	'res 0, l',		// 0x85
	'res 0, [hl]',	// 0x86
	'res 0, a',		// 0x87
	'res 1, b',		// 0x88
	'res 1, c',		// 0x89
	'res 1, d',		// 0x8A
	'res 1, e',		// 0x8B
	'res 1, h',		// 0x8C
	'res 1, l',		// 0x8D
	'res 1, [hl]',	// 0x8E
	'res 1, a',		// 0x8F
	'res 2, b',		// 0x90
	'res 2, c',		// 0x91
	'res 2, d',		// 0x92
	'res 2, e',		// 0x93
	'res 2, h',		// 0x94
	'res 2, l',		// 0x95
	'res 2, [hl]',	// 0x96
	'res 2, a',		// 0x97
	'res 3, b',		// 0x98
	'res 3, c',		// 0x99
	'res 3, d',		// 0x9A
	'res 3, e',		// 0x9B
	'res 3, h',		// 0x9C
	'res 3, l',		// 0x9D
	'res 3, [hl]',	// 0x9E
	'res 3, a',		// 0x9F
	'res 4, b',		// 0xA0
	'res 4, c',		// 0xA1
	'res 4, d',		// 0xA2
	'res 4, e',		// 0xA3
	'res 4, h',		// 0xA4
	'res 4, l',		// 0xA5
	'res 4, [hl]',	// 0xA6
	'res 4, a',		// 0xA7
	'res 5, b',		// 0xA8
	'res 5, c',		// 0xA9
	'res 5, d',		// 0xAA
	'res 5, e',		// 0xAB
	'res 5, h',		// 0xAC
	'res 5, l',		// 0xAD
	'res 5, [hl]',	// 0xAE
	'res 5, a',		// 0xAF
	'res 6, b',		// 0xB0
	'res 6, c',		// 0xB1
	'res 6, d',		// 0xB2
	'res 6, e',		// 0xB3
	'res 6, h',		// 0xB4
	'res 6, l',		// 0xB5
	'res 6, [hl]',	// 0xB6
	'res 6, a',		// 0xB7
	'res 7, b',		// 0xB8
	'res 7, c',		// 0xB9
	'res 7, d',		// 0xBA
	'res 7, e',		// 0xBB
	'res 7, h',		// 0xBC
	'res 7, l',		// 0xBD
	'res 7, [hl]',	// 0xBE
	'res 7, a',		// 0xBF	
	'set 0, b',		// 0xC0
	'set 0, c',		// 0xC1
	'set 0, d',		// 0xC2
	'set 0, e',		// 0xC3
	'set 0, h',		// 0xC4
	'set 0, l',		// 0xC5
	'set 0, [hl]',	// 0xC6
	'set 0, a',		// 0xC7
	'set 1, b',		// 0xC8
	'set 1, c',		// 0xC9
	'set 1, d',		// 0xCA
	'set 1, e',		// 0xCB
	'set 1, h',		// 0xCC
	'set 1, l',		// 0xCD
	'set 1, [hl]',	// 0xCE
	'set 1, a',		// 0xCF
	'set 2, b',		// 0xD0
	'set 2, c',		// 0xD1
	'set 2, d',		// 0xD2
	'set 2, e',		// 0xD3
	'set 2, h',		// 0xD4
	'set 2, l',		// 0xD5
	'set 2, [hl]',	// 0xD6
	'set 2, a',		// 0xD7
	'set 3, b',		// 0xD8
	'set 3, c',		// 0xD9
	'set 3, d',		// 0xDA
	'set 3, e',		// 0xDB
	'set 3, h',		// 0xDC
	'set 3, l',		// 0xDD
	'set 3, [hl]',	// 0xDE
	'set 3, a',		// 0xDF
	'set 4, b',		// 0xE0
	'set 4, c',		// 0xE1
	'set 4, d',		// 0xE2
	'set 4, e',		// 0xE3
	'set 4, h',		// 0xE4
	'set 4, l',		// 0xE5
	'set 4, [hl]',	// 0xE6
	'set 4, a',		// 0xE7
	'set 5, b',		// 0xE8
	'set 5, c',		// 0xE9
	'set 5, d',		// 0xEA
	'set 5, e',		// 0xEB
	'set 5, h',		// 0xEC
	'set 5, l',		// 0xED
	'set 5, [hl]',	// 0xEE
	'set 5, a',		// 0xEF
	'set 6, b',		// 0xF0
	'set 6, c',		// 0xF1
	'set 6, d',		// 0xF2
	'set 6, e',		// 0xF3
	'set 6, h',		// 0xF4
	'set 6, l',		// 0xF5
	'set 6, [hl]',	// 0xF6
	'set 6, a',		// 0xF7
	'set 7, b',		// 0xF8
	'set 7, c',		// 0xF9
	'set 7, d',		// 0xFA
	'set 7, e',		// 0xFB
	'set 7, h',		// 0xFC
	'set 7, l',		// 0xFD
	'set 7, [hl]',	// 0xFE
	'set 7, a'		// 0xFF
];

module.exports = OpCodes;