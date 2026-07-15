class ZCL_ZPE_ADV_ODATA_DPC_EXT definition
  public
  inheriting from ZCL_ZPE_ADV_ODATA_DPC
  create public .

public section.

  methods /IWBEP/IF_MGW_APPL_SRV_RUNTIME~EXECUTE_ACTION
    redefinition .
  methods /IWBEP/IF_MGW_APPL_SRV_RUNTIME~CREATE_DEEP_ENTITY
    redefinition .
protected section.

  methods ZSTR_ESTOQUE_ODA_CREATE_ENTITY
    redefinition .
  methods ZSTR_ESTOQUE_ODA_DELETE_ENTITY
    redefinition .
  methods ZSTR_ESTOQUE_ODA_GET_ENTITY
    redefinition .
  methods ZSTR_ESTOQUE_ODA_GET_ENTITYSET
    redefinition .
  methods ZSTR_ESTOQUE_ODA_UPDATE_ENTITY
    redefinition .
  methods ZTPE_BOMSET_CREATE_ENTITY
    redefinition .
  methods ZTPE_BOMSET_DELETE_ENTITY
    redefinition .
  methods ZTPE_BOMSET_GET_ENTITY
    redefinition .
  methods ZTPE_BOMSET_GET_ENTITYSET
    redefinition .
  methods ZTPE_BOMSET_UPDATE_ENTITY
    redefinition .
  methods ZTPE_LOG_MOVSET_GET_ENTITYSET
    redefinition .
  methods ZTPE_MATERIALSET_CREATE_ENTITY
    redefinition .
  methods ZTPE_MATERIALSET_DELETE_ENTITY
    redefinition .
  methods ZTPE_MATERIALSET_GET_ENTITY
    redefinition .
  methods ZTPE_MATERIALSET_GET_ENTITYSET
    redefinition .
  methods ZTPE_MATERIALSET_UPDATE_ENTITY
    redefinition .
  methods ZTPE_PED_CABSET_CREATE_ENTITY
    redefinition .
  methods ZTPE_PED_CABSET_GET_ENTITY
    redefinition .
  methods ZTPE_PED_CABSET_GET_ENTITYSET
    redefinition .
  methods ZTPE_PED_ITEMSET_CREATE_ENTITY
    redefinition .
  methods ZTPE_PED_ITEMSET_DELETE_ENTITY
    redefinition .
  methods ZTPE_PED_ITEMSET_GET_ENTITYSET
    redefinition .
  methods ZTPE_PED_ITEMSET_UPDATE_ENTITY
    redefinition .
  methods ZTPE_UNMEDIDASET_CREATE_ENTITY
    redefinition .
  methods ZTPE_UNMEDIDASET_DELETE_ENTITY
    redefinition .
  methods ZTPE_UNMEDIDASET_GET_ENTITY
    redefinition .
  methods ZTPE_UNMEDIDASET_GET_ENTITYSET
    redefinition .
  methods ZTPE_UNMEDIDASET_UPDATE_ENTITY
    redefinition .
private section.
ENDCLASS.



CLASS ZCL_ZPE_ADV_ODATA_DPC_EXT IMPLEMENTATION.


METHOD /iwbep/if_mgw_appl_srv_runtime~create_deep_entity.
  TYPES: BEGIN OF ty_s_pedido_deep.
      INCLUDE TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_ped_cab.
  TYPES: ztpe_ped_itemset TYPE STANDARD TABLE OF zcl_zpe_adv_odata_mpc=>ts_ztpe_ped_item WITH EMPTY KEY,
         END OF ty_s_pedido_deep.

  DATA: ls_pedido_fiori TYPE ty_s_pedido_deep,
        lo_pedido       TYPE REF TO zcl_pe_pedido_entity,
        lo_inventory    TYPE REF TO zcl_pe_inventory_manager.

  CASE iv_entity_set_name.

    WHEN 'ZTPE_PED_CABSet'.

      " lê o json
      io_data_provider->read_entry_data( IMPORTING es_data = ls_pedido_fiori ).

      " busca o prox numero
      DATA(lv_proximo_numero) = zcl_pe_pedido_entity=>get_next_number( ).

      lo_pedido = NEW zcl_pe_pedido_entity( iv_numero_pedido = lv_proximo_numero ).

      DATA(lo_estoque_entity) = NEW zcl_pe_estoque_entity( ).
      lo_inventory = NEW zcl_pe_inventory_manager( io_estoque = lo_estoque_entity ).

      LOOP AT ls_pedido_fiori-ztpe_ped_itemset INTO DATA(ls_item_fiori).

        SELECT SINGLE codigocm, tipocm
          FROM ztpe_material
          WHERE codigocm = @ls_item_fiori-codigomp
          INTO @DATA(lv_material_check).

        IF sy-subrc <> 0 or lv_material_check-tipocm <> '1'.
          DATA(lo_msg_container) = me->mo_context->get_message_container( ).

          lo_msg_container->add_message_text_only(
            EXPORTING
              iv_msg_type               = 'E'
              iv_msg_text               = |Erro: O material '{ ls_item_fiori-codigomp }' não existe no cadastro ou não é MP!|
              iv_add_to_response_header = abap_true
          ).

          RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
            EXPORTING
              message_container = lo_msg_container.
        ENDIF.

        lo_pedido->zif_pe_pedido_entity~add_item(
          iv_material   = ls_item_fiori-codigomp
          iv_quantidade = ls_item_fiori-quantidademp
        ).

        lo_inventory->post_movement(
          EXPORTING
            iv_tipo       = 'E'
            iv_quantidade = ls_item_fiori-quantidademp
            iv_codigom    = ls_item_fiori-codigomp
        ).

      ENDLOOP.

      lo_pedido->zif_pe_pedido_entity~save( ).

      ls_pedido_fiori-numeropedido = lv_proximo_numero.
      ls_pedido_fiori-datap        = sy-datum.

      LOOP AT ls_pedido_fiori-ztpe_ped_itemset ASSIGNING FIELD-SYMBOL(<fs_item>).
        <fs_item>-numeropedido = lv_proximo_numero.
      ENDLOOP.

      copy_data_to_ref(
        EXPORTING
          is_data = ls_pedido_fiori
        CHANGING
          cr_data = er_deep_entity
      ).

    WHEN OTHERS.
      CALL METHOD super->/iwbep/if_mgw_appl_srv_runtime~create_deep_entity
        EXPORTING
          iv_entity_name          = iv_entity_name
          iv_entity_set_name      = iv_entity_set_name
          iv_source_name          = iv_source_name
          io_data_provider        = io_data_provider
          it_key_tab              = it_key_tab
          it_navigation_path      = it_navigation_path
          io_expand               = io_expand
          io_tech_request_context = io_tech_request_context
        IMPORTING
          er_deep_entity          = er_deep_entity.
  ENDCASE.
ENDMETHOD.


METHOD /iwbep/if_mgw_appl_srv_runtime~execute_action.
  IF iv_action_name = 'ExecuteProductionProcess'.

    DATA: lv_material   TYPE zpe_codigomp,
          lv_quantidade TYPE zpe_quantidademp,
          lv_tipocm     TYPE zpe_tipocm,
          lo_engine     TYPE REF TO zcl_pe_production_engine.

    " pega valores URL
    DATA(ls_param_mat) = VALUE #( it_parameter[ name = 'Material' ] OPTIONAL ).
    DATA(ls_param_qtd) = VALUE #( it_parameter[ name = 'Quantidade' ] OPTIONAL ).

    " validação url
    IF ls_param_mat IS INITIAL OR ls_param_qtd IS INITIAL.
      mo_context->get_message_container( )->add_message_text_only(
        iv_msg_type = 'E'
        iv_msg_text = 'Parâmetros Material e Quantidade são obrigatórios.'
      ).
      RETURN.
    ENDIF.

    lv_material   = ls_param_mat-value.
    lv_quantidade = ls_param_qtd-value.

    " conversão 0 a esquerda
    CALL FUNCTION 'CONVERSION_EXIT_ALPHA_INPUT'
      EXPORTING
        input  = lv_material
      IMPORTING
        output = lv_material.

    " pega o tipo do material
    SELECT SINGLE tipocm
      FROM ztpe_material
      INTO @lv_tipocm
      WHERE codigocm = @lv_material.

    IF sy-subrc <> 0.
      " se nao existe
      mo_context->get_message_container( )->add_message_text_only(
        iv_msg_type = 'E'
        iv_msg_text = 'Erro: Material não cadastrado no sistema.'
      ).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error.

    ELSEIF lv_tipocm <> '2'. " se material for diferente de 2 (PA)
      mo_context->get_message_container( )->add_message_text_only(
        iv_msg_type = 'E'
        iv_msg_text = 'Processo negado: O material informado é uma Matéria-Prima. Apenas Produtos Acabados (Tipo 2) podem ser produzidos.'
      ).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error.
    ENDIF.

    " instancia a engine
    lo_engine = NEW zcl_pe_production_engine( ).

    TRY.
        IF lo_engine->execute_production( iv_material   = lv_material
                                          iv_quantidade = lv_quantidade ) = abap_true.

          " produto gerado (cenario A)
          DATA: ls_material_retorno TYPE ztpe_material.

          SELECT SINGLE codigocm, descricaocm, tipocm, unidade_medidacm
            FROM ztpe_material
            INTO CORRESPONDING FIELDS OF @ls_material_retorno
            WHERE codigocm = @lv_material.

          IF sy-subrc = 0 AND ls_material_retorno IS NOT INITIAL.
            copy_data_to_ref(
              EXPORTING
                is_data = ls_material_retorno
              CHANGING
                cr_data = er_data
            ).
          ELSE.
            DATA(lv_success) = abap_true.
            copy_data_to_ref( EXPORTING is_data = lv_success CHANGING cr_data = er_data ).
          ENDIF.

        ELSE.
          RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
            EXPORTING
              textid = /iwbep/cx_mgw_busi_exception=>business_error.
        ENDIF.

      CATCH cx_root INTO DATA(lo_ex).
        " error bro
        mo_context->get_message_container( )->add_message(
          iv_msg_type               = 'E'
          iv_msg_id                 = 'ZPE_MSG'
          iv_msg_number             = '007'
          iv_add_to_response_header = abap_true
        ).

        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            textid = /iwbep/cx_mgw_busi_exception=>business_error.
    ENDTRY.

  ENDIF.
ENDMETHOD.


  METHOD zstr_estoque_oda_create_entity.
    TRY.
        DATA(lo_msg_container) = mo_context->get_message_container( ).

        lo_msg_container->add_message_text_only(
          EXPORTING
            iv_msg_type               = 'E'
            iv_msg_text               = 'Operação bloqueada. O registro de estoque nasce automaticamente com o Material.'
            iv_add_to_response_header = abap_true
        ).

        " Retorna HTTP 405 - Method Not Allowed
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            http_status_code  = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-method_not_allowed
            message_container = lo_msg_container.

      CATCH cx_root INTO DATA(lx_root).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception
          EXPORTING
            previous = lx_root.
    ENDTRY.
  ENDMETHOD.


  METHOD zstr_estoque_oda_delete_entity.

    DATA: ls_key_data   TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_estoque,
          lv_quantidade TYPE ztpe_estoque-quantidadem.

    TRY.
        " 1. Captura a chave primária que vem da URL (Codigom)
        io_tech_request_context->get_converted_keys(
          IMPORTING
            es_key_values = ls_key_data
        ).

        " 2. Busca a quantidade atual para validar a regra de negócio
        SELECT SINGLE quantidadem
          FROM ztpe_estoque
          INTO @lv_quantidade
          WHERE codigom = @ls_key_data-codigom.

        " 3. Regra de Negócio: Bloqueia se o material ainda tiver saldo físico real
        IF sy-subrc = 0 AND lv_quantidade > 0.
          DATA(lo_msg_container) = mo_context->get_message_container( ).

          lo_msg_container->add_message_text_only(
            EXPORTING
              iv_msg_type               = 'E'
              iv_msg_text               = 'Não é possível remover o material do estoque pois ele ainda possui saldo ativo.'
              iv_add_to_response_header = abap_true
          ).

          RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
            EXPORTING
              http_status_code  = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-conflict
              message_container = lo_msg_container.
        ENDIF.

        " 4. Se o saldo for zero, executa a limpeza em Cascata Reversa
        " Remove a linha de controle de estoque
        DELETE FROM ztpe_estoque WHERE codigom = @ls_key_data-codigom.

        " Remove o cadastro do material para não deixar dados órfãos no sistema
        DELETE FROM ztpe_material WHERE codigocm = @ls_key_data-codigom.

        " Se não encontrou o registro para deletar, devolve 404
        IF sy-subrc <> 0.
          RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
            EXPORTING
              http_status_code = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-not_found.
        ENDIF.

      CATCH cx_root INTO DATA(lx_root).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception
          EXPORTING
            previous = lx_root.
    ENDTRY.
  ENDMETHOD.


  method ZSTR_ESTOQUE_ODA_GET_ENTITY.
DATA: ls_key_tab TYPE /iwbep/s_mgw_name_value_pair,
          lv_codigom TYPE ztpe_estoque-codigom.

    " 1. Ler a chave 'Codigom' da URL de forma segura (ignorando a validação chata do Gateway)
    READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'Codigom'.
    IF sy-subrc <> 0.
      READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'CODIGOM'.
    ENDIF.

    IF sy-subrc = 0.
      lv_codigom = ls_key_tab-value.
    ENDIF.

    " 2. A Mágica da Opção 2: SELECT SINGLE com JOIN jogando direto para o retorno do OData
    SELECT SINGLE e~codigom,
                  e~quantidadem,
                  m~descricaocm,
                  m~tipocm,
                  m~unidade_medidacm
      FROM ztpe_estoque AS e
      INNER JOIN ztpe_material AS m
        ON e~codigom = m~codigocm
      INTO CORRESPONDING FIELDS OF @er_entity
      WHERE e~codigom = @lv_codigom.

    " 3. Retorna HTTP 404 se o registro não for encontrado
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>resource_not_found
          http_status_code = '404'.
    ENDIF.

  endmethod.


METHOD zstr_estoque_oda_get_entityset.

    DATA: lv_top   TYPE i,
          lv_skip  TYPE i,
          lv_count TYPE i.

    " 1. Declarar os RANGES para cada campo que a tela poderá usar como filtro
    DATA: lr_codigom TYPE RANGE OF ztpe_estoque-codigom,
          lr_tipocm  TYPE RANGE OF ztpe_material-tipocm.

    " 2. Paginação (Proteção contra requisições vazias)
    lv_top  = io_tech_request_context->get_top( ).
    lv_skip = io_tech_request_context->get_skip( ).

    IF lv_top = 0.
      lv_top = 99999.
    ENDIF.

    " 3. Leitura Mágica dos Filtros ($filter)
    " O SAP pega o que veio na URL e transforma numa tabela interna
   " 3. Leitura Mágica dos Filtros ($filter)
    DATA(lt_filters) = io_tech_request_context->get_filter( )->get_filter_select_options( ).

    LOOP AT lt_filters INTO DATA(ls_filter).
      " O segredo: Converter o nome da propriedade para MAIÚSCULO antes de comparar
      CASE to_upper( ls_filter-property ).

        WHEN 'CODIGOM'.
          LOOP AT ls_filter-select_options INTO DATA(ls_opt_c).
            APPEND INITIAL LINE TO lr_codigom ASSIGNING FIELD-SYMBOL(<fs_c>).
            <fs_c>-sign   = ls_opt_c-sign.
            <fs_c>-option = ls_opt_c-option.
            <fs_c>-low    = ls_opt_c-low.
            <fs_c>-high   = ls_opt_c-high.
          ENDLOOP.

        WHEN 'TIPOCM'.
          LOOP AT ls_filter-select_options INTO DATA(ls_opt_t).
            APPEND INITIAL LINE TO lr_tipocm ASSIGNING FIELD-SYMBOL(<fs_t>).
            <fs_t>-sign   = ls_opt_t-sign.
            <fs_t>-option = ls_opt_t-option.
            <fs_t>-low    = ls_opt_t-low.
            <fs_t>-high   = ls_opt_t-high.
          ENDLOOP.

      ENDCASE.
    ENDLOOP.

    " 4. Busca no Banco de Dados (Aplicando os Filtros)
    " Repare no comando IN @lr_... Ele só vai filtrar se a tela mandar algo.
    " Se a tela não mandar filtro, o Range fica vazio e o ABAP traz tudo (comportamento perfeito).
    SELECT e~codigom,
           e~quantidadem,
           m~descricaocm,
           m~tipocm,
           m~unidade_medidacm,
           u~descricaounm
      FROM ztpe_estoque AS e
      INNER JOIN ztpe_material AS m
        ON e~codigom = m~codigocm
      LEFT OUTER JOIN ztpe_unmedida AS u
      on m~unidade_medidacm = u~codigounm
      WHERE e~codigom IN @lr_codigom
        AND m~tipocm  IN @lr_tipocm
      ORDER BY e~codigom
      INTO CORRESPONDING FIELDS OF TABLE @et_entityset
      UP TO @lv_top ROWS
      OFFSET @lv_skip.

    " 5. Contagem Total (Inlinecount) também aplicando os filtros!
    " Se a tela filtrou Tipocm = '1', o total de páginas tem que ser baseado apenas nesse tipo.
    IF io_tech_request_context->has_inlinecount( ) = abap_true.

      SELECT COUNT( * )
        FROM ztpe_estoque AS e
        INNER JOIN ztpe_material AS m
          ON e~codigom = m~codigocm
        WHERE e~codigom IN @lr_codigom
          AND m~tipocm  IN @lr_tipocm
        INTO @lv_count.

      es_response_context-inlinecount = lv_count.

    ENDIF.

  ENDMETHOD.


METHOD zstr_estoque_oda_update_entity.

    DATA: ls_key_tab   TYPE /iwbep/s_mgw_name_value_pair,
          lv_codigom   TYPE ztpe_estoque-codigom,
          ls_payload   TYPE zstr_estoque_odata.

    DATA: lo_inventory TYPE REF TO zcl_pe_inventory_manager,
          lv_qtd_atual TYPE ztpe_estoque-quantidadem.

    " 1. Captura o código do material vindo da URI
    READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'Codigom'.
    IF sy-subrc <> 0.
      READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'CODIGOM'.
    ENDIF.
    IF sy-subrc = 0.
      lv_codigom = ls_key_tab-value.
    ENDIF.

    " 2. Captura os dados enviados no JSON
    io_data_provider->read_entry_data( IMPORTING es_data = ls_payload ).

    IF ls_payload-tipol IS INITIAL.
      ls_payload-tipol = 'I'.
    ENDIF.

    " 3. Validações de segurança do negócio
    SELECT SINGLE codigocm
      FROM ztpe_material
      INTO @DATA(lv_mat_check)
      WHERE codigocm = @lv_codigom.

    IF sy-subrc <> 0.
      mo_context->get_message_container( )->add_message_text_only(
        iv_msg_type = 'E'
        iv_msg_text = 'Material informado não existe no cadastro.'
      ).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message_container = mo_context->get_message_container( )
          http_status_code  = '404'.
    ENDIF.

    SELECT SINGLE quantidadem
      FROM ztpe_estoque
      INTO @lv_qtd_atual
      WHERE codigom = @lv_codigom.

    IF sy-subrc <> 0.
      IF ls_payload-tipol = 'S'.
        mo_context->get_message_container( )->add_message_text_only(
          iv_msg_type = 'E'
          iv_msg_text = 'Não é possível realizar saída de um estoque inexistente.'
        ).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            message_container = mo_context->get_message_container( )
            http_status_code  = '400'.
      ENDIF.
    ELSE.
      IF ls_payload-tipol = 'S' AND lv_qtd_atual < ls_payload-quantidadem.
        mo_context->get_message_container( )->add_message_text_only(
          iv_msg_type = 'E'
          iv_msg_text = 'Saldo insuficiente para realizar a saída (Estoque negativo não permitido).'
        ).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            message_container = mo_context->get_message_container( )
            http_status_code  = '400'.
      ENDIF.
    ENDIF.

    " 4. Instancia a classe gerenciadora e executa a movimentação
    lo_inventory = NEW zcl_pe_inventory_manager( ).

    TRY.
        lo_inventory->post_movement(
          EXPORTING
            iv_tipo       = CONV #( to_upper( ls_payload-tipol ) )
            iv_quantidade = ls_payload-quantidadem
            iv_codigom    = lv_codigom
        ).

        " 5. Retorno de sucesso para o Gateway
        er_entity = ls_payload.

      CATCH cx_root INTO DATA(lo_ex).
        DATA(lv_err_msg) = CONV bapi_msg( lo_ex->get_text( ) ).
        mo_context->get_message_container( )->add_message_text_only(
          iv_msg_type = 'E'
          iv_msg_text = lv_err_msg
        ).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            message_container = mo_context->get_message_container( )
            http_status_code  = '500'.
    ENDTRY.

  ENDMETHOD.


  method ZTPE_BOMSET_CREATE_ENTITY.
    DATA: ls_entrada_fiori TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_bom,
          lo_bom TYPE REF TO zcl_pe_material_bom.

    DATA: lo_material_mp TYPE REF TO zif_pe_material_entity,
          lo_material_pa TYPE REF TO zif_pe_material_entity.

    " Pega requisição do Fiori
    TRY.
      io_data_provider->read_entry_data( IMPORTING es_data = ls_entrada_fiori ).
    CATCH /iwfnd/cx_mgw_tech_exception.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '400'.
    ENDTRY.

    " Validar se a quantidade recebida é maior que 0
    IF ls_entrada_fiori-quantidademp <= 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = VALUE scx_t100key( msgid = 'ZPE_MSG'
                                      msgno = '004' )
          http_status_code = '400'.
    ENDIF.

    " Validar se existe duplicidade de COD. PA e MP
    SELECT SINGLE @abap_true
      FROM ztpe_bom
      INTO @DATA(lv_bom_existe)
      WHERE codigopa = @ls_entrada_fiori-codigopa
        AND codigomp = @ls_entrada_fiori-codigomp.

    IF sy-subrc = 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = VALUE scx_t100key( msgid = 'ZPE_MSG'
                                                msgno = '023' )
          http_status_code = '400'.
    ENDIF.

    "Criando Objeto de BOM
    CREATE OBJECT lo_bom.

    "Criado Objetos dos Materias (MP e PA) carregando do Banco
    CREATE OBJECT lo_material_mp TYPE zcl_pe_material_entity
      EXPORTING
        iv_codigo = ls_entrada_fiori-codigomp.
    lo_material_mp->load(
      EXPORTING
        iv_codigo = ls_entrada_fiori-codigomp ).

    CREATE OBJECT lo_material_pa TYPE zcl_pe_material_entity
      EXPORTING
        iv_codigo = ls_entrada_fiori-codigopa.
    lo_material_pa->load(
      EXPORTING
        iv_codigo = ls_entrada_fiori-codigopa ).

    " Checa se os códigos são válidos e adiciona os componentes ao BOM
    lo_bom->check_is_raw_material( io_material = lo_material_mp ).
    lo_bom->check_is_finished_product( io_material = lo_material_pa ).

    lo_bom->add_component_to_list(
      EXPORTING
        io_mat_mp = lo_material_mp
        io_mat_pa = lo_material_pa
        iv_quantidade = ls_entrada_fiori-quantidademp
      RECEIVING
        rv_valid = DATA(lv_registrou)
        ).

    "Se retornar TRUE manda 201 para o Fiori
    IF lv_registrou = abap_true.
      er_entity = ls_entrada_fiori.

    ELSE.
      DATA(lv_erro) = lo_bom->get_message( ).
      DATA(lo_msg_container) = mo_context->get_message_container( ).

      lo_msg_container->add_message_text_only(
        EXPORTING
          iv_msg_type = 'E'
          iv_msg_text = |{ lv_erro }|
      ).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          http_status_code = '400'
          message_container = lo_msg_container.
    ENDIF.
  endmethod.


  method ZTPE_BOMSET_DELETE_ENTITY.
    DATA: lv_codigopa TYPE ztpe_bom-codigopa,
          lv_codigomp TYPE ztpe_bom-codigomp.

    READ TABLE it_key_tab INTO DATA(ls_key_mp) WITH KEY name = 'Codigomp'.
    IF sy-subrc = 0.
      lv_codigomp = ls_key_mp-value.
    ENDIF.

    READ TABLE it_key_tab INTO DATA(ls_key_pa) WITH KEY name = 'Codigopa'.
    IF sy-subrc = 0.
      lv_codigopa = ls_key_pa-value.
    ENDIF.

    "Validar se o registro existe
    SELECT SINGLE @abap_true
      FROM ztpe_bom
      INTO @DATA(lv_existe)
      WHERE codigopa = @lv_codigomp
        AND codigomp = @lv_codigomp.

    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>resource_not_found
          http_status_code = '404'
          message = 'Item não encontrado ou já foi excluído'.
    ENDIF.

    "Deleta caso encontrar o registro
    DELETE FROM ztpe_bom
      WHERE codigopa = @lv_codigopa
        AND codigomp = @lv_codigomp.

  endmethod.


  method ZTPE_BOMSET_GET_ENTITY.
    DATA: lv_codigopa TYPE ztpe_bom-codigopa,
          lv_codigomp TYPE ztpe_bom-codigomp.

    READ TABLE it_key_tab INTO DATA(ls_key_pa) WITH KEY name = 'Codigopa'.
    IF sy-subrc = 0. lv_codigopa = ls_key_pa-value. ENDIF.

    READ TABLE it_key_tab INTO DATA(ls_key_mp) WITH KEY name = 'Codigomp'.
    IF sy-subrc = 0. lv_codigomp = ls_key_mp-value. ENDIF.

    SELECT SINGLE codigopa, codigomp, quantidademp
      FROM ztpe_bom
      INTO CORRESPONDING FIELDS OF @er_entity
      WHERE codigopa = @lv_codigopa
        AND codigomp = @lv_codigomp.

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            textid = /iwbep/cx_mgw_busi_exception=>resource_not_found
            http_status_code = '404'
            message = 'A estrutura BOM solicitada não existe'.
      ENDIF.

  endmethod.


  method ZTPE_BOMSET_GET_ENTITYSET.
    DATA: lr_codigopa TYPE /iwbep/t_cod_select_options,
          lr_codigomp TYPE /iwbep/t_cod_select_options.

    "Pega o objeto de filtros da requisição
    DATA(lo_filtro) = io_tech_request_context->get_filter( ).
    DATA(lt_filtro) = lo_filtro->get_filter_select_options( ).

    READ TABLE lt_filtro WITH KEY property = 'Codigopa' INTO DATA(ls_f_pa).
    IF sy-subrc = 0.
      lr_codigopa = ls_f_pa-select_options.
    ENDIF.

    READ TABLE lt_filtro WITH KEY property = 'Codigomp' INTO DATA(ls_f_mp).
    IF sy-subrc = 0.
      lr_codigomp = ls_f_mp-select_options.
    ENDIF.

    "Faz a leitura do Banco com os filtros passados
    SELECT codigopa, codigomp, quantidademp
      FROM ZTPE_BOM
      INTO CORRESPONDING FIELDS OF TABLE @ET_ENTITYSET
      WHERE codigopa IN @lr_codigopa
        AND codigomp IN @lr_codigomp
      ORDER BY codigopa, codigomp.
  endmethod.


  method ZTPE_BOMSET_UPDATE_ENTITY.
    DATA: lv_codigopa TYPE ztpe_bom-codigopa,
          lv_codigomp TYPE ztpe_bom-codigomp,
          ls_data     TYPE ztpe_bom.

    READ TABLE it_key_tab INTO DATA(ls_key_pa) WITH KEY name = 'Codigopa'.
    IF sy-subrc = 0.
      lv_codigopa = ls_key_pa-value.
    ENDIF.

    READ TABLE it_key_tab INTO DATA(ls_key_mp) WITH KEY name = 'Codigomp'.
    IF sy-subrc = 0.
      lv_codigomp = ls_key_mp-value.
    ENDIF.

    io_data_provider->read_entry_data( IMPORTING es_data = ls_data ).

    "Validar a quantidade passada
    IF ls_data-quantidademp IS INITIAL OR ls_data-quantidademp <= 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = VALUE scx_t100key( msgid = 'ZPE_MSG'
                                      msgno = '004' )
          http_status_code = '400'.
    ENDIF.

    "Validar se a requisiação passada batem
    IF ( ls_data-codigopa IS NOT INITIAL AND ls_data-codigopa <> lv_codigopa ) OR
       ( ls_data-codigomp IS NOT INITIAL AND ls_data-codigomp <> lv_codigomp ).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '400'
          message = 'As chaves da requisição não correspondem com a URL informada'.
    ENDIF.

    "Faz update se código é passado, se não encontrar o cod. dispara erro
    IF lv_codigopa IS NOT INITIAL and lv_codigomp IS NOT INITIAL.
      UPDATE ztpe_bom SET quantidademp = @ls_data-quantidademp
        WHERE codigopa = @lv_codigopa
          AND codigomp = @lv_codigomp.

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            textid           = /iwbep/cx_mgw_busi_exception=>business_error
            http_status_code = '404'
            message          = 'Registro nao encontrado para atualizacao.'.
      ELSE.
        er_entity = ls_data.

      ENDIF.
    ENDIF.

  endmethod.


METHOD ztpe_log_movset_get_entityset.

    DATA: lv_top   TYPE i,
          lv_skip  TYPE i,
          lv_count TYPE i.

    " 1. Declarar os RANGES para os filtros dinâmicos
    DATA: lr_datal   TYPE RANGE OF ztpe_log_mov-datal,
          lr_codigom TYPE RANGE OF ztpe_log_mov-codigom,
          lr_tipol   TYPE RANGE OF ztpe_log_mov-tipol.

    " 2. Paginação (Proteção contra dumps se não houver limite)
    lv_top  = io_tech_request_context->get_top( ).
    lv_skip = io_tech_request_context->get_skip( ).

    IF lv_top = 0.
      lv_top = 99999.
    ENDIF.

    " 3. Leitura dos Filtros ($filter) da URL e conversão para RANGES
    DATA(lt_filters) = io_tech_request_context->get_filter( )->get_filter_select_options( ).

    LOOP AT lt_filters INTO DATA(ls_filter).
      CASE to_upper( ls_filter-property ).

        WHEN 'DATAL'.
          LOOP AT ls_filter-select_options INTO DATA(ls_opt_d).
            APPEND INITIAL LINE TO lr_datal ASSIGNING FIELD-SYMBOL(<fs_d>).
            <fs_d>-sign   = ls_opt_d-sign.
            <fs_d>-option = ls_opt_d-option.
            <fs_d>-low    = ls_opt_d-low.
            <fs_d>-high   = ls_opt_d-high.
          ENDLOOP.

        WHEN 'CODIGOM'.
          LOOP AT ls_filter-select_options INTO DATA(ls_opt_c).
            APPEND INITIAL LINE TO lr_codigom ASSIGNING FIELD-SYMBOL(<fs_c>).
            <fs_c>-sign   = ls_opt_c-sign.
            <fs_c>-option = ls_opt_c-option.
            <fs_c>-low    = ls_opt_c-low.
            <fs_c>-high   = ls_opt_c-high.
          ENDLOOP.

        WHEN 'TIPOL'.
          LOOP AT ls_filter-select_options INTO DATA(ls_opt_t).
            APPEND INITIAL LINE TO lr_tipol ASSIGNING FIELD-SYMBOL(<fs_t>).
            <fs_t>-sign   = ls_opt_t-sign.
            <fs_t>-option = ls_opt_t-option.
            <fs_t>-low    = ls_opt_t-low.
            <fs_t>-high   = ls_opt_t-high.
          ENDLOOP.

      ENDCASE.
    ENDLOOP.

    " 4. Busca Mágica no Banco de Dados com Filtros e Paginação
    " O ORDER BY datal DESCENDING garante que o log mais recente apareça no topo da tabela do Fiori
    SELECT *
      FROM ztpe_log_mov
      WHERE datal   IN @lr_datal
        AND codigom IN @lr_codigom
        AND tipol   IN @lr_tipol
      ORDER BY datal DESCENDING
      INTO CORRESPONDING FIELDS OF TABLE @et_entityset
      UP TO @lv_top ROWS
      OFFSET @lv_skip.

    " 5. Contagem Total para o Paginador do Fiori ($inlinecount)
    IF io_tech_request_context->has_inlinecount( ) = abap_true.

      SELECT COUNT( * )
        FROM ztpe_log_mov
        WHERE datal   IN @lr_datal
          AND codigom IN @lr_codigom
          AND tipol   IN @lr_tipol
        INTO @lv_count.

      es_response_context-inlinecount = lv_count.

    ENDIF.

  ENDMETHOD.


METHOD ztpe_materialset_create_entity.

  DATA: lv_proximo_codigo TYPE numc4.

  TRY.
      io_data_provider->read_entry_data(
        IMPORTING
          es_data = er_entity
      ).

      zcl_validate_unit_exists=>validate_type_exists( iv_tipocm = er_entity-tipocm ).
      zcl_validate_unit_exists=>validate_unit_exists( iv_unmedida = er_entity-unidade_medidacm ).

      CALL FUNCTION 'NUMBER_GET_NEXT'
        EXPORTING
          nr_range_nr             = '01'
          object                  = 'ZPE_MAT'
        IMPORTING
          number                  = lv_proximo_codigo
        EXCEPTIONS
          interval_not_found      = 1
          number_range_not_intern = 2
          object_not_found        = 3
          quantity_is_0           = 4
          quantity_is_not_1       = 5
          interval_overflow       = 6
          buffer_overflow         = 7
          OTHERS                  = 8.

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception.
      ENDIF.

      er_entity-codigocm = lv_proximo_codigo.

      zcl_validate_unit_exists=>validate_material_duplicate( iv_codigocm = er_entity-codigocm ).

      INSERT ztpe_material FROM @( CORRESPONDING #( er_entity ) ).

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception.
      ENDIF.

      DATA: ls_estoque TYPE ztpe_estoque.
      ls_estoque-codigom     = er_entity-codigocm.
      ls_estoque-quantidadem = 0.

      INSERT ztpe_estoque FROM @ls_estoque.

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception.
      ENDIF.

    CATCH /iwbep/cx_mgw_busi_exception INTO DATA(lx_busi).
      DATA(lo_msg_container) = mo_context->get_message_container( ).
      lo_msg_container->add_message_text_only(
        EXPORTING
          iv_msg_type               = 'E'
          iv_msg_text               = 'Unidade de medida inválida ou inexistente.'
          iv_add_to_response_header = abap_true
      ).

      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          http_status_code  = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-bad_request
          message_container = lo_msg_container.

    " Rede de segurança geral
    CATCH cx_root INTO DATA(lx_root).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception
        EXPORTING
          previous = lx_root.
  ENDTRY.

ENDMETHOD.


METHOD ztpe_materialset_delete_entity.

  DATA: ls_key_data   TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_material,
        lv_quantidade TYPE ztpe_estoque-quantidadem.

  TRY.
      io_tech_request_context->get_converted_keys(
        IMPORTING
          es_key_values = ls_key_data
      ).

      SELECT SINGLE quantidadem
        FROM ztpe_estoque
        INTO @lv_quantidade
        WHERE codigom = @ls_key_data-codigocm.

      IF sy-subrc = 0 AND lv_quantidade > 0.
        DATA(lo_msg_container) = mo_context->get_message_container( ).

        lo_msg_container->add_message_text_only(
          EXPORTING
            iv_msg_type               = 'E'
            iv_msg_text               = 'Material não pode ser excluído pois possui estoque ativo.'
            iv_add_to_response_header = abap_true
        ).

        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            http_status_code  = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-conflict
            message_container = lo_msg_container.
      ENDIF.

      DELETE FROM ztpe_estoque WHERE codigom = @ls_key_data-codigocm.

      DELETE FROM ztpe_material WHERE codigocm = @ls_key_data-codigocm.

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            http_status_code = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-not_found.
      ENDIF.

    CATCH cx_root INTO DATA(lx_root).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception
        EXPORTING
          previous = lx_root.
  ENDTRY.

ENDMETHOD.


METHOD ztpe_materialset_get_entity.

  DATA: ls_key_tab  LIKE LINE OF it_key_tab,
        lv_codigocm TYPE ztpe_material-codigocm.

  " 1. Ler a chave do Material vinda da URL (tratando variações)
  READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'Codigocm'.
  IF sy-subrc <> 0.
    READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'CODIGOCM'.
  ENDIF.
  IF sy-subrc <> 0.
    " Caso na SEGW a propriedade tenha sido nomeada apenas como Codigom
    READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'Codigom'.
  ENDIF.
  IF sy-subrc <> 0.
    READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'CODIGOM'.
  ENDIF.

  IF sy-subrc = 0.
    lv_codigocm = ls_key_tab-value.
  ENDIF.

  " 2. Busca simples e performática na tabela física de materiais
  SELECT SINGLE codigocm,
                descricaocm,
                tipocm,
                unidade_medidacm
    FROM ztpe_material
    INTO CORRESPONDING FIELDS OF @er_entity
    WHERE codigocm = @lv_codigocm.

  " 3. Retorna 404 se o material não existir no cadastro
  IF sy-subrc <> 0.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid           = /iwbep/cx_mgw_busi_exception=>resource_not_found
        http_status_code = '404'.
  ENDIF.

ENDMETHOD.


METHOD ztpe_materialset_get_entityset.

  DATA: lv_osql_where TYPE string,
        lv_top        TYPE i,
        lv_skip       TYPE i,
        lv_count      TYPE i.

  TRY.
      " 1. Captura os parâmetros da URL enviados pelo Front-end
      lv_osql_where = io_tech_request_context->get_osql_where_clause( ).
      lv_top        = io_tech_request_context->get_top( ).
      lv_skip       = io_tech_request_context->get_skip( ).

      " Trava de segurança: Se o front-end não pedir limite, travamos em 1000
      " para evitar que um select exploda a memória do servidor (Memory Dump).
      IF lv_top IS INITIAL.
        lv_top = 1000.
      ENDIF.

      " 2. Busca Otimizada no Banco de Dados
      SELECT *
        FROM ztpe_material
        WHERE (lv_osql_where)
        ORDER BY codigocm
        INTO CORRESPONDING FIELDS OF TABLE @et_entityset
        UP TO @lv_top ROWS
        OFFSET @lv_skip.

      " 3. Otimização de Count para Paginação do Fiori Elements / SmartTables
      IF io_tech_request_context->has_inlinecount( ) = abap_true.
        IF et_entityset IS NOT INITIAL.
          SELECT COUNT( * )
            FROM ztpe_material
            WHERE (lv_osql_where)
            INTO @lv_count.
        ELSE.
          lv_count = 0.
        ENDIF.

        es_response_context-inlinecount = lv_count.
      ENDIF.

    " 4. Tratamento de Exceções
    CATCH cx_sy_dynamic_osql_error.
      DATA(lo_msg_container) = mo_context->get_message_container( ).
      lo_msg_container->add_message_text_only(
        EXPORTING
          iv_msg_type               = 'E'
          iv_msg_text               = 'Filtro de pesquisa inválido ou mal formatado.'
          iv_add_to_response_header = abap_true
      ).

      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          http_status_code  = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-bad_request
          message_container = lo_msg_container.

    CATCH cx_root INTO DATA(lx_root).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception
        EXPORTING
          previous = lx_root.
  ENDTRY.

ENDMETHOD.


METHOD ztpe_materialset_update_entity.

  DATA: ls_key_data TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_material,
        ls_material TYPE ztpe_material.

  TRY.
      " 1. Captura a chave primária da URL
      io_tech_request_context->get_converted_keys(
        IMPORTING
          es_key_values = ls_key_data
      ).

      " 2. Leitura dos dados do Payload (JSON)
      io_data_provider->read_entry_data(
        IMPORTING
          es_data = er_entity
      ).

      " 3. Consistência de Segurança
      er_entity-codigocm = ls_key_data-codigocm.

      " 4. Validações de Negócio
      zcl_validate_unit_exists=>validate_type_exists( iv_tipocm = er_entity-tipocm ).
      zcl_validate_unit_exists=>validate_unit_exists( iv_unmedida = er_entity-unidade_medidacm ).

      " 5. Mapeamento Seguro e Update
      " Passamos os dados da entidade do OData para a estrutura idêntica à do banco
      ls_material = CORRESPONDING #( er_entity ).

      UPDATE ztpe_material FROM ls_material.

      " 6. Checagem de Existência
      IF sy-subrc <> 0.
        DATA(lo_msg_container) = mo_context->get_message_container( ).

        lo_msg_container->add_message_text_only(
          EXPORTING
            iv_msg_type               = 'E'
            iv_msg_text               = 'Material não encontrado para atualização.'
            iv_add_to_response_header = abap_true
        ).

        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            http_status_code  = /iwbep/cx_mgw_busi_exception=>gcs_http_status_codes-not_found
            message_container = lo_msg_container.
      ENDIF.

    CATCH /iwbep/cx_mgw_busi_exception INTO DATA(lx_busi).
      RAISE EXCEPTION lx_busi.

    CATCH cx_root INTO DATA(lx_root).
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_tech_exception
        EXPORTING
          previous = lx_root.
  ENDTRY.

ENDMETHOD.


  METHOD ztpe_ped_cabset_create_entity.

    DATA: ls_entry  TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_ped_cab,
          lo_pedido TYPE REF TO zcl_pe_pedido_entity.

    io_data_provider->read_entry_data( IMPORTING es_data = ls_entry ).

    ls_entry-numeropedido = zcl_pe_pedido_entity=>get_next_number( ).

    IF ls_entry-datap IS INITIAL.
      ls_entry-datap = sy-datum.
    ENDIF.

    CREATE OBJECT lo_pedido
      EXPORTING
        iv_numero_pedido = ls_entry-numeropedido.

    lo_pedido->zif_pe_pedido_entity~save( ).

    " devolve oq foi gerado p fiori
    er_entity = ls_entry.

  ENDMETHOD.


  METHOD ztpe_ped_cabset_get_entity.

* importante, aparentemente somos obrigado a passar a mandante na requisição
* nesse caso, 800. Ja que a tabela foi populada nesta
* /sap/opu/odata/sap/ZPE_ADV_ODATA_SRV/ZTPE_PED_CABSet(Mandt='800',Numeropedido='1000')?$format=json

    DATA: ls_key_tab LIKE LINE OF it_key_tab,
          lv_numero  TYPE ztpe_ped_cab-numeropedido.

    " ler a chave "numeropedido" que passa nas chaves do fiori
    READ TABLE it_key_tab INTO ls_key_tab WITH KEY name = 'Numeropedido'.
    IF sy-subrc = 0.
      lv_numero = ls_key_tab-value.
    ENDIF.

    " busca só oq foi pedido
    SELECT SINGLE numeropedido, datap
      FROM ztpe_ped_cab
      INTO CORRESPONDING FIELDS OF @er_entity
      WHERE numeropedido = @lv_numero.

    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>resource_not_found
          http_status_code = '404'.
    ENDIF.

  ENDMETHOD.


METHOD ztpe_ped_cabset_get_entityset.

  DATA: lo_pedido TYPE REF TO zcl_pe_pedido_entity.

  CREATE OBJECT lo_pedido.

  IF lo_pedido->zif_pe_pedido_entity~find_all( ) = abap_true.

    DATA(lt_dados) = lo_pedido->zif_pe_pedido_entity~get_display( ).

    " copia os campos correspondentes (Numeropedido e Datap) para a tabela de saída do Gateway
    MOVE-CORRESPONDING lt_dados TO et_entityset.

    " preenche mandante
    FIELD-SYMBOLS: <ls_entity> LIKE LINE OF et_entityset.
    LOOP AT et_entityset ASSIGNING <ls_entity>.
      <ls_entity>-mandt = sy-mandt.
    ENDLOOP.

  ELSE.

    DATA(lv_msg) = lo_pedido->zif_pe_pedido_entity~get_message( ).

    IF lv_msg IS INITIAL.
      lv_msg = 'Nenhum pedido encontrado no sistema.'.
    ENDIF.

    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid           = /iwbep/cx_mgw_busi_exception=>business_error
        http_status_code = '404'.

  ENDIF.

ENDMETHOD.


  METHOD ztpe_ped_itemset_create_entity.
    DATA: ls_data   TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_ped_item,
          lo_pedido TYPE REF TO zcl_pe_pedido_entity.

    " 1. Capturar os dados do novo item vindos no Body do POST (JSON)
    io_data_provider->read_entry_data( IMPORTING es_data = ls_data ).

    " 2. Instanciar a classe especialista
    CREATE OBJECT lo_pedido.

    " 3. Invoca a persistência encapsulada
    IF lo_pedido->zif_pe_pedido_entity~create_new_item(
         iv_numeropedido = ls_data-numeropedido
         iv_codigomp     = ls_data-codigomp
         iv_quantidade   = ls_data-quantidademp ) = abap_true.

      " Se gravou com sucesso, preenchemos o retorno obrigatório do OData
      er_entity = ls_data.

    ELSE.
      " Erro ao criar (Ex: Registro duplicado ou dados inválidos)
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '400'. " Bad Request
    ENDIF.
  ENDMETHOD.


  METHOD ztpe_ped_itemset_delete_entity.

    DATA: ls_key_tab  LIKE LINE OF it_key_tab,
          lv_pedido   TYPE ztpe_ped_item-numeropedido,
          lv_material TYPE ztpe_ped_item-codigomp.

    " pega numeropedido e codigomp da url
    LOOP AT it_key_tab INTO ls_key_tab.
      CASE ls_key_tab-name.
        WHEN 'Numeropedido'.
          lv_pedido = ls_key_tab-value.
        WHEN 'Codigomp'.
          lv_material = ls_key_tab-value.
      ENDCASE.
    ENDLOOP.

    IF lv_pedido IS INITIAL OR lv_material IS INITIAL.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid      = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '400'.
    ENDIF.

    " deleta
    DELETE FROM ztpe_ped_item
     WHERE numeropedido = @lv_pedido
       AND codigomp     = @lv_material.

    " verifica se realmente existia e foi deletado
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid      = /iwbep/cx_mgw_busi_exception=>resource_not_found
          http_status_code = '404'.
    ENDIF.

    " Dica: O método DELETE do OData não precisa retornar nenhuma tabela ou estrutura (er_entity),
    " o próprio status HTTP 204 (No Content) que o SAP envia já avisa o Fiori que deu certo!

  ENDMETHOD.


  METHOD ztpe_ped_itemset_get_entityset.

    DATA: lo_pedido TYPE REF TO zcl_pe_pedido_entity,
          ls_filter TYPE /iwbep/s_mgw_select_option,
          ls_range  TYPE /iwbep/s_cod_select_option,
          lv_id_ped TYPE zpe_numeropedido,
          lt_dados  TYPE ztpe_t_ped_display.

    " tenta capturar filtro (?$filter=Numeropedido eq 'XXXX')
    READ TABLE it_filter_select_options INTO ls_filter WITH KEY property = 'Numeropedido'.
    IF sy-subrc = 0.
      READ TABLE ls_filter-select_options INTO ls_range INDEX 1.
      IF sy-subrc = 0.
        lv_id_ped = ls_range-low.
      ENDIF.
    ENDIF.

    CREATE OBJECT lo_pedido.

    IF lv_id_ped IS NOT INITIAL.
      " se veio pedido especifico na requisição
      IF lo_pedido->zif_pe_pedido_entity~find_by_filter( iv_numeroped = lv_id_ped ) = abap_true.
        lt_dados = lo_pedido->zif_pe_pedido_entity~get_display( ).
      ENDIF.
    ELSE.
      " se não tiver filtro, traz todos validos
      IF lo_pedido->zif_pe_pedido_entity~find_all( ) = abap_true.
        lt_dados = lo_pedido->zif_pe_pedido_entity~get_display( ).
      ENDIF.
    ENDIF.

    " copia os resultados p tabela de saída do Gateway (et_entityset)
    MOVE-CORRESPONDING lt_dados TO et_entityset.

    " preenche o mandante em cada saída
    FIELD-SYMBOLS: <ls_entity> LIKE LINE OF et_entityset.
    LOOP AT et_entityset ASSIGNING <ls_entity>.
      <ls_entity>-mandt = sy-mandt.
    ENDLOOP.

  ENDMETHOD.


  METHOD ztpe_ped_itemset_update_entity.

      DATA: ls_key_tab  LIKE LINE OF it_key_tab,
            lv_pedido   TYPE ztpe_ped_item-numeropedido,
            lv_material TYPE ztpe_ped_item-codigomp,
            ls_data     TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_ped_item,
            lo_pedido   TYPE REF TO zcl_pe_pedido_entity.

      LOOP AT it_key_tab INTO ls_key_tab.
        CASE ls_key_tab-name.
          WHEN 'Numeropedido'.
            lv_pedido = ls_key_tab-value.
          WHEN 'Codigomp'.
            lv_material = ls_key_tab-value.
        ENDCASE.
      ENDLOOP.

      io_data_provider->read_entry_data( IMPORTING es_data = ls_data ).

      CREATE OBJECT lo_pedido.

      IF lo_pedido->zif_pe_pedido_entity~update_item(
           iv_numeropedido = lv_pedido
           iv_codigomp     = lv_material
           iv_quantidade   = ls_data-quantidademp ) = abap_true.

        ls_data-numeropedido = lv_pedido.
        ls_data-codigomp     = lv_material.
        er_entity            = ls_data.

      ELSE.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            textid           = /iwbep/cx_mgw_busi_exception=>business_error
            http_status_code = '400'.
      ENDIF.

  ENDMETHOD.


  method ZTPE_UNMEDIDASET_CREATE_ENTITY.
    DATA: ls_entrada_fiori TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_unmedida,
          ls_unmedida      TYPE ztpe_unmedida,
          lv_existe        TYPE abap_bool VALUE abap_false.

    " Pega requisição do Fiori
    TRY.
      io_data_provider->read_entry_data( IMPORTING es_data = ls_entrada_fiori ).

     CATCH /iwbep/cx_mgw_tech_exception.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '400'.
    ENDTRY.

    " Move para a variavel e valida se Descrição está vazio.
    MOVE-CORRESPONDING ls_entrada_fiori TO ls_unmedida.

    IF ls_unmedida-descricaounm IS INITIAL.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = VALUE scx_t100key( msgid = 'ZPE_MSG'
                                      msgno = '048' )
          http_status_code = '400'.
    ENDIF.

    " Verifica se esse Código de Medida existe através do metódo e marca uma variavel Booleana
    TRY.
      zcl_validate_unit_exists=>validate_unit_exists( iv_unmedida = ls_unmedida-codigounm ).
      lv_existe = abap_true.

     CATCH /iwbep/cx_mgw_busi_exception.
       lv_existe = abap_false.

    ENDTRY.

    IF lv_existe = abap_true.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = VALUE scx_t100key( msgid = 'ZPE_MSG'
                                      msgno = '046' )
          http_status_code = '400'.
    ENDIF.

    " Caso não exista passa a inserir na tabela e retorna 201 para o Fiori
    INSERT ztpe_unmedida FROM @ls_unmedida.

    IF sy-subrc = 0.
      er_entity = ls_entrada_fiori.
    ELSE.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '500'.
    ENDIF.

  endmethod.


  method ZTPE_UNMEDIDASET_DELETE_ENTITY.
    DATA: lv_codigounm TYPE zpe_codigounm.

    READ TABLE it_key_tab INTO DATA(ls_key_cod) WITH KEY name = 'Codigounm'.
    IF sy-subrc = 0.
      lv_codigounm = ls_key_cod-value.
    ENDIF.

    DELETE FROM ztpe_unmedida
      WHERE codigounm = @lv_codigounm.

    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid      = /iwbep/cx_mgw_busi_exception=>resource_not_found
          http_status_code = '404'
          message = 'Unidade de Medida não encontrada.' .
    ENDIF.

  endmethod.


  method ZTPE_UNMEDIDASET_GET_ENTITY.
    DATA: lv_codigounm TYPE zpe_codigounm.

    READ TABLE it_key_tab INTO DATA(lv_key_codigoun) WITH KEY name = 'Codigounm'.
    IF sy-subrc = 0.
      lv_codigounm = lv_key_codigoun-value.
    ENDIF.

    SELECT SINGLE codigounm, descricaounm
      FROM ztpe_unmedida
      INTO CORRESPONDING FIELDS OF @er_entity
      WHERE codigounm = @lv_codigounm.

      IF sy-subrc <> 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            textid = /iwbep/cx_mgw_busi_exception=>resource_not_found
            http_status_code = '404'
            message = 'Unidade de Medida não encontrado'.
      ENDIF.

  endmethod.


  method ZTPE_UNMEDIDASET_GET_ENTITYSET.

    SELECT codigounm, descricaounm
      FROM ztpe_unmedida
      INTO CORRESPONDING FIELDS OF TABLE @et_entityset.

  endmethod.


  method ZTPE_UNMEDIDASET_UPDATE_ENTITY.
    DATA: ls_entrada_fiori TYPE zcl_zpe_adv_odata_mpc=>ts_ztpe_unmedida,
          lv_codigounm     TYPE zpe_codigounm.

    READ TABLE it_key_tab INTO DATA(ls_key_codigounm) WITH KEY name = 'Codigounm'.
    IF sy-subrc = 0.
      lv_codigounm = ls_key_codigounm-value.
    ENDIF.

    TRY.
      io_data_provider->read_entry_data( IMPORTING es_data = ls_entrada_fiori ).

    CATCH /iwbep/cx_mgw_tech_exception.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>business_error
          http_status_code = '400'.
    ENDTRY.

    UPDATE ztpe_unmedida
      SET descricaounm = @ls_entrada_fiori-descricaounm
    WHERE codigounm = @lv_codigounm.

    IF sy-subrc = 0.
      er_entity = ls_entrada_fiori.

     ELSE.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid = /iwbep/cx_mgw_busi_exception=>resource_not_found
          http_status_code = '404'.
    ENDIF.
  endmethod.
ENDCLASS.
